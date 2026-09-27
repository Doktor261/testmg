# SPDX-License-Identifier: MIT
"""
Ballistik-Simulation: Projektil gegen Wolframwürfel (Blender-Add-on)

Das Add-on berechnet den Schuss physikalisch und überträgt das Ergebnis als
Keyframe-Animation in eine Blender-Szene. Die Physik läuft in reinem Python
(ohne bpy) und lässt sich deshalb auch außerhalb von Blender testen.

Physikalische Modelle
---------------------
1. Außenballistik (Flug): Newton mit Schwerkraft und quadratischem
   Luftwiderstand  F = ½·ρ_Luft·c_w·A·|v|·v, integriert mit Runge-Kutta 4.
2. Aufprall-Kriterium: Kontaktspannung der ebenen Stoßwelle
   σ = v·Z_p·Z_t/(Z_p+Z_t) mit der akustischen Impedanz Z = √(E·ρ).
   Bleibt σ unter beiden Fließgrenzen, ist der Stoß elastisch:
   Masse-Feder-Modell (Stabsteifigkeit E·A/L in Reihe mit dem Boussinesq-
   Flachstempel k = 2·R·E*), Rückprall über die Stoßzahl e.
3. Eindringen (Endballistik): Tate-Alekseevskii-Modell
       ½·ρ_p·(v−u)² + Y_p = ½·ρ_t·u² + R_t
       dv/dt = −Y_p/(ρ_p·L),  dL/dt = −(v−u),  dP/dt = u
   inkl. der Grenzfälle starres Eindringen (u = v) und reine
   Oberflächenerosion ohne Penetration (u = 0).
   Zielwiderstand nach Tate:  R_t = Y_t·(2/3 + ln(0,57·E_t/Y_t)).
4. Kraterdurchmesser: Kavitätenexpansion (Energiebilanz Staudruck/R_t)
       D_k = D_p·√(1 + ρ_p·(v−u)²/(2·R_t))
5. Impulserhaltung: Der (optional frei gelagerte) Würfel übernimmt den
   Impuls, den Restprojektil und Splitter nicht forttragen.

Installation: Bearbeiten > Einstellungen > Add-ons > Installieren… und diese
Datei wählen, oder im Text-Editor öffnen und „Skript ausführen“.
Bedienung: 3D-Viewport > Seitenleiste (N) > Reiter „Ballistik“.
"""

bl_info = {
    "name": "Ballistik: Projektil gegen Wolframwürfel",
    "author": "testmg",
    "version": (1, 0, 0),
    "blender": (3, 6, 0),
    "location": "3D-Viewport > Seitenleiste (N) > Ballistik",
    "description": "Physikalisch basierte Simulation eines Projektileinschlags "
                   "in einen Wolframwürfel (Tate-Alekseevskii, Außenballistik, Impulserhaltung)",
    "category": "Physics",
}

import bisect
import json
import math
import random
import sys
from dataclasses import dataclass, fields

try:
    import bpy
    import bmesh
    from bpy.app.handlers import persistent
    from mathutils import Vector
except ImportError:  # reine Physik ohne Blender (Tests, Kommandozeile)
    bpy = None

    def persistent(func):
        return func


# ---------------------------------------------------------------------------
# Werkstoffdaten
# ---------------------------------------------------------------------------
# Schlüssel: (Anzeigename, Dichte kg/m³, dyn. Fließgrenze Pa, E-Modul Pa,
#             Querkontraktionszahl, RGB-Farbe, Metallisch, Rauheit)
# Die Fließgrenzen sind typische dynamische Werte (Hugoniot-/Taylor-Test-
# Größenordnung) und dienen als Startwerte – sie sind im Panel anpassbar.
MATERIALIEN = {
    "W": ("Wolfram (rein)", 19250.0, 1.5e9, 411e9, 0.28, (0.55, 0.55, 0.57), 1.0, 0.30),
    "WHA": ("Wolfram-Schwermetall (93W-Ni-Fe)", 17600.0, 1.2e9, 360e9, 0.29, (0.45, 0.45, 0.48), 1.0, 0.35),
    "DU": ("Abgereichertes Uran (U-0,75Ti)", 18600.0, 1.3e9, 172e9, 0.21, (0.30, 0.32, 0.30), 1.0, 0.45),
    "WC": ("Wolframcarbid (Hartmetall)", 15600.0, 4.0e9, 600e9, 0.24, (0.35, 0.36, 0.40), 0.9, 0.25),
    "STAHL_H": ("Panzerstahl (gehärtet)", 7850.0, 1.5e9, 210e9, 0.29, (0.60, 0.60, 0.62), 1.0, 0.35),
    "STAHL": ("Baustahl", 7850.0, 0.5e9, 210e9, 0.29, (0.62, 0.61, 0.60), 1.0, 0.45),
    "CU": ("Kupfer", 8960.0, 0.3e9, 120e9, 0.34, (0.95, 0.55, 0.40), 1.0, 0.30),
    "MESSING": ("Messing", 8500.0, 0.45e9, 100e9, 0.34, (0.90, 0.72, 0.35), 1.0, 0.30),
    "PB": ("Blei", 11340.0, 0.03e9, 16e9, 0.44, (0.40, 0.42, 0.45), 0.8, 0.60),
    "AL": ("Aluminium 7075-T6", 2810.0, 0.55e9, 71.7e9, 0.33, (0.80, 0.81, 0.83), 1.0, 0.35),
}

# Regime-Bezeichnungen
FLUG = "Flug (Außenballistik)"
ELASTISCH = "Elastischer Stoß (Masse-Feder)"
EROSION = "Hydrodynamische Erosion (Tate)"
STARR = "Starres Eindringen"
OBERFLAECHE = "Oberflächenerosion (keine Penetration)"
NACHLAUF = "Nachlauf"


@dataclass
class Parameter:
    """Alle Eingangsgrößen in SI-Einheiten."""
    # Projektil
    proj_dichte: float = 17600.0
    proj_fliessgrenze: float = 1.2e9
    proj_emodul: float = 360e9
    proj_poisson: float = 0.29
    proj_durchmesser: float = 0.010
    proj_laenge: float = 0.060
    proj_spitze_kaliber: float = 1.5      # Spitzenlänge in Kalibern (0 = Flachkopf)
    geschwindigkeit: float = 1500.0       # Mündungs-/Startgeschwindigkeit m/s
    elevation_grad: float = 0.0
    azimut_grad: float = 0.0
    # Ziel (Würfel)
    ziel_dichte: float = 19250.0
    ziel_fliessgrenze: float = 1.5e9
    ziel_emodul: float = 411e9
    ziel_poisson: float = 0.28
    wuerfel_kante: float = 0.100
    ziel_widerstand: float = 0.0          # R_t in Pa; 0 = automatisch nach Tate
    wuerfel_frei: bool = True             # reibungsfrei gelagert (Impulsübertrag)
    # Umgebung
    abstand: float = 0.30                 # Startabstand Spitze -> Würfelvorderseite
    gravitation: float = 9.81
    luftdichte: float = 1.225
    cw: float = 0.30
    stosszahl: float = 0.6                # Restitutionskoeffizient (elastischer Fall)
    # Splitter / Zeit
    fragmente: int = 40
    seed: int = 1
    nachlauf: float = 3e-4                # simulierte Zeit nach dem Eindringen (s)


# ---------------------------------------------------------------------------
# Kleine Vektorhilfen (ohne mathutils, damit die Physik bpy-frei bleibt)
# ---------------------------------------------------------------------------
def _add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _mul(a, s):
    return (a[0] * s, a[1] * s, a[2] * s)


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _norm(a):
    return math.sqrt(_dot(a, a))


def _unit(a):
    n = _norm(a)
    return _mul(a, 1.0 / n) if n > 0 else (1.0, 0.0, 0.0)


def _lerp(a, b, f):
    return tuple(x + (y - x) * f for x, y in zip(a, b))


def _orthobasis(d):
    h = (0.0, 0.0, 1.0) if abs(d[2]) < 0.9 else (0.0, 1.0, 0.0)
    e1 = _unit(_cross(d, h))
    return e1, _cross(d, e1)


# ---------------------------------------------------------------------------
# Geometrie des Projektils
# ---------------------------------------------------------------------------
def projektil_profil(prm, n_spitze=24):
    """Rotationsprofil [(x, r)] vom Heck (x=0) bis zur Spitze (x=L).

    Spitze als Tangentenogive (Spitzenlänge >= Radius) bzw. Halbellipsoid.
    """
    R = prm.proj_durchmesser / 2.0
    L = prm.proj_laenge
    Ln = min(max(prm.proj_spitze_kaliber, 0.0) * prm.proj_durchmesser, L)
    profil = [(0.0, R)]
    if Ln <= 1e-9:
        profil.append((L, R))
        return profil
    profil.append((L - Ln, R))
    rho = (R * R + Ln * Ln) / (2.0 * R)
    for i in range(1, n_spitze + 1):
        s = Ln * i / n_spitze
        if Ln >= R:
            r = math.sqrt(max(rho * rho - s * s, 0.0)) + R - rho
        else:
            r = R * math.sqrt(max(1.0 - (s / Ln) ** 2, 0.0))
        profil.append((L - Ln + s, max(r, 0.0) if i < n_spitze else 0.0))
    return profil


def profil_volumen(profil):
    """Volumen eines Rotationskörpers (Kegelstumpf-Summe)."""
    V = 0.0
    for (x0, r0), (x1, r1) in zip(profil, profil[1:]):
        V += math.pi * (x1 - x0) * (r0 * r0 + r0 * r1 + r1 * r1) / 3.0
    return V


# ---------------------------------------------------------------------------
# Physik
# ---------------------------------------------------------------------------
def zielwiderstand(prm):
    """R_t nach Tate: Y_t·(2/3 + ln(0,57·E_t/Y_t)), sofern nicht vorgegeben."""
    if prm.ziel_widerstand > 0:
        return prm.ziel_widerstand
    Yt, Et = prm.ziel_fliessgrenze, prm.ziel_emodul
    return Yt * (2.0 / 3.0 + math.log(max(0.57 * Et / Yt, 1.0)))


def grenzflaechengeschwindigkeit(v, rp, rt, Yp, Rt):
    """Löst die modifizierte Bernoulli-Gleichung nach u. Liefert (u, Regime)."""
    if Yp >= 0.5 * rt * v * v + Rt:
        return v, STARR
    if Rt >= 0.5 * rp * v * v + Yp:
        return 0.0, OBERFLAECHE
    # numerisch stabile Form der quadratischen Lösung (auch für rp == rt)
    D = rp * rt * v * v - 2.0 * (rt - rp) * (Rt - Yp)
    u = (rp * v * v - 2.0 * (Rt - Yp)) / (math.sqrt(max(D, 0.0)) + rp * v)
    return min(max(u, 0.0), v), EROSION


def _flug(pos, vel, masse, flaeche, prm, t0, t_max, halt=None, n_min=400):
    """RK4-Integration mit Schwerkraft + quadratischem Luftwiderstand.

    halt(pos) -> float: Vorzeichenwechsel von negativ nach >= 0 beendet den Flug
    (lineare Interpolation auf den Nulldurchgang). Liefert Liste (t, pos, vel)
    und ob der Halt erreicht wurde.
    """
    k = 0.5 * prm.luftdichte * prm.cw * flaeche / masse
    g = prm.gravitation

    def acc(v):
        s = _norm(v)
        return (-k * s * v[0], -k * s * v[1], -k * s * v[2] - g)

    dauer = max(t_max - t0, 0.0)
    dt = dauer / n_min if dauer > 0 else 0.0
    if halt is not None and _norm(vel) > 0:
        dt = min(dt, prm.abstand / _norm(vel) / n_min) if dt > 0 else prm.abstand / _norm(vel) / n_min
    samples = [(t0, pos, vel)]
    t = t0
    while t < t_max - 1e-15 and dt > 0:
        h = min(dt, t_max - t)
        k1v, k1x = acc(vel), vel
        k2v, k2x = acc(_add(vel, _mul(k1v, h / 2))), _add(vel, _mul(k1v, h / 2))
        k3v, k3x = acc(_add(vel, _mul(k2v, h / 2))), _add(vel, _mul(k2v, h / 2))
        k4v, k4x = acc(_add(vel, _mul(k3v, h))), _add(vel, _mul(k3v, h))
        npos = _add(pos, _mul(_add(_add(k1x, _mul(k2x, 2)), _add(_mul(k3x, 2), k4x)), h / 6))
        nvel = _add(vel, _mul(_add(_add(k1v, _mul(k2v, 2)), _add(_mul(k3v, 2), k4v)), h / 6))
        if halt is not None:
            h0, h1 = halt(pos), halt(npos)
            if h0 < 0 <= h1:
                f = -h0 / (h1 - h0)
                samples.append((t + f * h, _lerp(pos, npos, f), _lerp(vel, nvel, f)))
                return samples, True
        pos, vel, t = npos, nvel, t + h
        samples.append((t, pos, vel))
    return samples, False


def simuliere(prm):
    """Berechnet den kompletten Vorgang. Liefert ein JSON-fähiges dict."""
    rng = random.Random(prm.seed)
    R = prm.proj_durchmesser / 2.0
    A = math.pi * R * R
    profil = projektil_profil(prm)
    V0 = profil_volumen(profil)
    m0 = prm.proj_dichte * V0
    Leq0 = V0 / A                      # massengleicher Zylinder (Tate-Länge)
    a = prm.wuerfel_kante
    rp, rt = prm.proj_dichte, prm.ziel_dichte
    Yp, Yt = prm.proj_fliessgrenze, prm.ziel_fliessgrenze
    Rt = zielwiderstand(prm)
    M_wuerfel = rt * a ** 3

    # Projektil-Zeitreihe: t, Spitze, Richtung, L/L0, sichtbar, v, u, P, Phase
    zr = {k: [] for k in ("t", "spitze", "richtung", "lrel", "sichtbar", "v", "u", "P", "phase")}

    def sample(t, spitze, richtung, lrel, v, u=None, P=0.0, phase=FLUG, sichtbar=True):
        zr["t"].append(t)
        zr["spitze"].append(tuple(spitze))
        zr["richtung"].append(tuple(richtung))
        zr["lrel"].append(lrel)
        zr["sichtbar"].append(sichtbar)
        zr["v"].append(v)
        zr["u"].append(u)
        zr["P"].append(P)
        zr["phase"].append(phase)

    # ---------------- 1. Flug ----------------
    el, az = math.radians(prm.elevation_grad), math.radians(prm.azimut_grad)
    richtung0 = (math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el))
    start = (-prm.abstand, 0.0, 0.0)
    v0vec = _mul(richtung0, prm.geschwindigkeit)
    t_max_flug = 20.0 * prm.abstand / max(prm.geschwindigkeit, 1e-6)
    flug, getroffen_ebene = _flug(start, v0vec, m0, A, prm, 0.0, t_max_flug, halt=lambda p: p[0])
    for t, p, v in flug:
        sample(t, p, _unit(v), 1.0, _norm(v))
    t_imp, p_imp, v_imp_vec = flug[-1]
    v_imp = _norm(v_imp_vec)
    d = _unit(v_imp_vec)
    getroffen = getroffen_ebene and abs(p_imp[1]) <= a / 2 and abs(p_imp[2]) <= a / 2

    erg = {
        "masse": m0, "volumen": V0, "L_eq": Leq0, "R_t": Rt, "M_wuerfel": M_wuerfel,
        "t_aufprall": t_imp, "v_aufprall": v_imp, "p_aufprall": p_imp, "d": d,
        "E_start": 0.5 * m0 * prm.geschwindigkeit ** 2, "E_aufprall": 0.5 * m0 * v_imp ** 2,
        "getroffen": getroffen, "regime": [], "fragmente": [], "krater": [],
        "eindringtiefe": 0.0, "v_rest": 0.0, "m_rest": m0, "t_ende": t_imp,
        "v_wuerfel": (0.0, 0.0, 0.0), "kontaktspannung": 0.0,
    }

    def nachlauf_frei(pos, vel, masse, lrel, t0, P=0.0):
        t_end = t0 + prm.nachlauf
        flug2, _ = _flug(pos, vel, max(masse, 1e-12), A, prm, t0, t_end, n_min=200)
        for t, p, v in flug2[1:]:
            sample(t, p, _unit(v), lrel, _norm(v), phase=NACHLAUF, P=P)
        return t_end

    if not getroffen:
        erg["ergebnis"] = "Verfehlt"
        erg["regime"] = [FLUG]
        tn = nachlauf_frei(p_imp, v_imp_vec, m0, 1.0, t_imp)
        erg["t_ende"] = t_imp
        erg["t_sim_ende"] = tn
        erg["zeitreihe"] = zr
        _energiebilanz(erg, prm, m0)
        return erg

    # ---------------- 2. Aufprallkriterium ----------------
    Zp = math.sqrt(prm.proj_emodul * rp)
    Zt = math.sqrt(prm.ziel_emodul * rt)
    sigma = v_imp * Zp * Zt / (Zp + Zt)
    erg["kontaktspannung"] = sigma
    M_eff = M_wuerfel if prm.wuerfel_frei else float("inf")

    if sigma <= min(Yp, Yt):
        # ---- elastischer Stoß: Masse-Feder-Modell (Normalkomponente entlang -x) ----
        # Feder = axiale Stabsteifigkeit E_p·A/L in Reihe mit dem starren
        # Flachstempel auf dem elastischen Halbraum (Boussinesq): k = 2·R·E*.
        E_stern = 1.0 / ((1 - prm.proj_poisson ** 2) / prm.proj_emodul
                         + (1 - prm.ziel_poisson ** 2) / prm.ziel_emodul)
        k_stempel = 2.0 * R * E_stern
        k_stab = prm.proj_emodul * A / Leq0
        k_ges = 1.0 / (1.0 / k_stempel + 1.0 / k_stab)
        m_red = m0 if math.isinf(M_eff) else m0 * M_eff / (m0 + M_eff)
        vn = v_imp_vec[0]
        omega = math.sqrt(k_ges / m_red)
        delta = vn / omega                      # maximale Annäherung
        t_c = math.pi / omega                   # Kontaktdauer (halbe Schwingung)
        n = 60
        for i in range(1, n + 1):
            tau = t_c * i / n
            s_ = math.sin(math.pi * tau / t_c)
            eindruck = delta * k_ges / k_stempel * s_     # Eindrückung ins Ziel
            stauchung = delta * k_ges / k_stab * s_       # elastische Stabstauchung
            sample(t_imp + tau, _add(p_imp, _mul(d, eindruck)), d, 1.0 - stauchung / Leq0,
                   v_imp * abs(math.cos(math.pi * tau / t_c)), phase=ELASTISCH)
        e = prm.stosszahl
        if math.isinf(M_eff):
            vn_p, vn_w = -e * vn, 0.0
        else:
            vn_p = (m0 - e * M_eff) * vn / (m0 + M_eff)
            vn_w = (1 + e) * m0 * vn / (m0 + M_eff)
        v_nach = (vn_p, v_imp_vec[1], v_imp_vec[2])
        t_ende = t_imp + t_c
        erg.update(regime=[ELASTISCH], ergebnis="Abpraller", t_ende=t_ende, v_rest=_norm(v_nach),
                   m_rest=m0, v_wuerfel=(vn_w, 0.0, 0.0), max_annaeherung=delta,
                   kontaktzeit=t_c, rest_frei=True)
        erg["t_sim_ende"] = nachlauf_frei(p_imp, v_nach, m0, 1.0, t_ende)
        erg["zeitreihe"] = zr
        _energiebilanz(erg, prm, m0)
        return erg

    # ---------------- 3. Tate-Alekseevskii ----------------
    dicke = a / max(d[0], 1e-6)          # Weglänge durch den Würfel
    v, L, P, t = v_imp, Leq0, 0.0, t_imp
    dt = Leq0 / max(v_imp, 1.0) / 3000.0
    roh = [(t, v, None, L, P, None)]
    regime_liste = []
    ergebnis = None

    def abl(v_, L_):
        u_, reg_ = grenzflaechengeschwindigkeit(v_, rp, rt, Yp, Rt)
        if reg_ == STARR:
            return -(0.5 * rt * v_ * v_ + Rt) / (rp * L_), 0.0, v_, u_, reg_
        return -Yp / (rp * L_), -(v_ - u_), u_, u_, reg_

    for _ in range(3_000_000):
        dv1, dL1, dP1, u, reg = abl(v, L)
        if not regime_liste or regime_liste[-1] != reg:
            regime_liste.append(reg)
        vm, Lm = v + 0.5 * dt * dv1, L + 0.5 * dt * dL1
        if vm <= 0 or Lm <= 0:
            dv2, dL2, dP2 = dv1, dL1, dP1
        else:
            dv2, dL2, dP2, _, _ = abl(vm, Lm)
        vn, Ln, Pn = v + dt * dv2, L + dt * dL2, P + dt * dP2
        if vn <= 0.0:                    # Stillstand: auf v = 0 interpolieren
            f = v / (v - vn) if v > vn else 1.0
            t, L, P, v = t + f * dt, L + f * (Ln - L), P + f * (Pn - P), 0.0
            roh.append((t, v, u, L, P, reg))
            ergebnis = "Steckschuss" if P > 1e-6 else "Projektil an der Oberfläche gestaucht"
            break
        if Pn >= dicke:                  # Durchschuss
            f = (dicke - P) / (Pn - P)
            t, v, L, P = t + f * dt, v + f * (vn - v), L + f * (Ln - L), dicke
            roh.append((t, v, u, L, P, reg))
            ergebnis = "Durchschuss"
            break
        if Ln <= 0.005 * Leq0:           # vollständig erodiert
            t, v, L, P = t + dt, vn, 0.0, Pn
            roh.append((t, v, u, L, P, reg))
            ergebnis = "Projektil vollständig aufgezehrt"
            break
        t, v, L, P = t + dt, vn, Ln, Pn
        roh.append((t, v, u, L, P, reg))
    else:
        ergebnis = "Steckschuss"
    roh[0] = (roh[0][0], roh[0][1], roh[1][2], roh[0][3], roh[0][4], roh[1][5])

    # Zeitreihe (ausgedünnt) übernehmen
    schritt = max(1, len(roh) // 1500)
    for i, (ti, vi, ui, Li, Pi, regi) in enumerate(roh):
        if i % schritt and i != len(roh) - 1:
            continue
        sample(ti, _add(p_imp, _mul(d, Pi)), d, Li / Leq0, vi, ui, Pi, regi, sichtbar=Li > 0)

    # Kraterprofil: (Tiefe, Radius)
    krater = []
    for ti, vi, ui, Li, Pi, regi in roh:
        if regi == EROSION:
            rk = R * math.sqrt(1.0 + rp * (vi - ui) ** 2 / (2.0 * Rt))
        elif regi == STARR:
            rk = 1.02 * R
        else:
            continue
        if not krater or Pi - krater[-1][0] >= 1e-3 * R:
            krater.append((Pi, rk))
    if len(krater) >= 2 and krater[-1][0] > 0.05 * R:
        erg["krater"] = krater
    V_krater = sum(math.pi * 0.5 * (r0 * r0 + r1 * r1) * (p1 - p0)
                   for (p0, r0), (p1, r1) in zip(krater, krater[1:])) if erg["krater"] else 0.0

    m_rest = rp * A * max(L, 0.0)
    if ergebnis == "Projektil vollständig aufgezehrt":
        m_rest, v = 0.0, 0.0
    t_ende = t
    erg.update(regime=regime_liste, ergebnis=ergebnis, t_ende=t_ende, eindringtiefe=P,
               v_rest=v, m_rest=m_rest, u_start=roh[0][2], V_krater=V_krater,
               kraterdurchmesser=2 * krater[0][1] if erg["krater"] else 0.0)

    # ---------------- 4. Splitter (Erosionsprodukte und Kraterauswurf) ----------------
    V_p_erod = A * (Leq0 - max(L, 0.0))
    V_ges = V_p_erod + V_krater
    n_ges = max(prm.fragmente, 0)
    n_p = round(n_ges * V_p_erod / V_ges) if V_ges > 0 else 0
    n_t = n_ges - n_p if V_krater > 0 else 0
    kum_p = [A * (Leq0 - r[3]) for r in roh]
    kum_t, acc_v = [0.0], 0.0
    for r0_, r1_ in zip(roh, roh[1:]):
        rk0 = R * math.sqrt(1.0 + rp * ((r0_[1] - (r0_[2] or 0)) ** 2) / (2 * Rt))
        acc_v += math.pi * rk0 * rk0 * max(r1_[4] - r0_[4], 0.0)
        kum_t.append(acc_v)
    e1, e2 = _orthobasis(d)
    fragmente = []
    impuls_frag = (0.0, 0.0, 0.0)
    E_frag = 0.0

    def zustand_bei(kum, ziel):
        i = min(max(bisect.bisect_left(kum, ziel), 1), len(kum) - 1)
        return roh[i]

    for quelle, anzahl, kum, V_tot, dichte in (("projektil", n_p, kum_p, V_p_erod, rp),
                                                ("ziel", n_t, kum_t, V_krater, rt)):
        if anzahl <= 0 or V_tot <= 0:
            continue
        V_stueck = V_tot / anzahl
        for k in range(anzahl):
            ti, vi, ui, Li, Pi, regi = zustand_bei(kum, (k + rng.random()) / anzahl * V_tot)
            ui = ui or 0.0
            phi = rng.uniform(0, 2 * math.pi)
            radial = _add(_mul(e1, math.cos(phi)), _mul(e2, math.sin(phi)))
            if regi == OBERFLAECHE:
                theta = math.radians(rng.uniform(70, 88))      # Abfluss entlang der Oberfläche
                speed = vi * rng.uniform(0.7, 1.0)
            elif quelle == "projektil":
                theta = math.radians(rng.uniform(10, 55))      # Rückstrom aus dem Krater
                speed = max(abs(2 * ui - vi), 0.1 * vi) * rng.uniform(0.6, 1.0)
            else:
                theta = math.radians(rng.uniform(15, 60))
                speed = ui * rng.uniform(0.2, 0.6)
            richtung = _unit(_add(_mul(d, -math.cos(theta)), _mul(radial, math.sin(theta))))
            rk = krater[0][1] if krater else R
            pos = _add(_add(p_imp, _mul(d, -0.2 * R)), _mul(radial, rk * rng.uniform(0.2, 0.9)))
            masse = dichte * V_stueck
            vel = _mul(richtung, speed)
            impuls_frag = _add(impuls_frag, _mul(vel, masse))
            E_frag += 0.5 * masse * speed * speed
            fragmente.append({"t0": ti, "pos": pos, "vel": vel, "masse": masse, "quelle": quelle,
                              "radius": (3 * V_stueck / (4 * math.pi)) ** (1 / 3)})
    erg["fragmente"] = fragmente
    erg["E_fragmente"] = E_frag

    # ---------------- 5. Impulserhaltung, Nachlauf ----------------
    p_ein = _mul(d, m0 * v_imp)
    M_rest_wuerfel = M_wuerfel - rt * V_krater
    frei = ergebnis == "Durchschuss"
    erg["rest_frei"] = frei
    if prm.wuerfel_frei:
        if frei:
            V_w = _mul(_sub(_sub(p_ein, impuls_frag), _mul(d, m_rest * v)), 1.0 / M_rest_wuerfel)
        else:  # Restprojektil steckt und bewegt sich mit dem Würfel
            V_w = _mul(_sub(p_ein, impuls_frag), 1.0 / (M_rest_wuerfel + m_rest))
    else:
        V_w = (0.0, 0.0, 0.0)
    erg["v_wuerfel"] = V_w
    erg["M_wuerfel_rest"] = M_rest_wuerfel

    lrel = max(L, 0.0) / Leq0
    spitze_ende = _add(p_imp, _mul(d, P))
    if frei:
        erg["t_sim_ende"] = nachlauf_frei(spitze_ende, _mul(d, v), m_rest, lrel, t_ende, P=P)
    else:
        n = 100
        for i in range(1, n + 1):
            tau = prm.nachlauf * i / n
            sample(t_ende + tau, _add(spitze_ende, _mul(V_w, tau)), d, lrel, _norm(V_w),
                   phase=NACHLAUF, P=P, sichtbar=L > 0)
        erg["t_sim_ende"] = t_ende + prm.nachlauf
    erg["zeitreihe"] = zr
    _energiebilanz(erg, prm, m0)
    return erg


def _energiebilanz(erg, prm, m0):
    M = erg.get("M_wuerfel_rest", erg["M_wuerfel"])
    V_w = _norm(erg["v_wuerfel"])
    if erg["ergebnis"] in ("Steckschuss", "Projektil an der Oberfläche gestaucht"):
        E_w = 0.5 * (M + erg["m_rest"]) * V_w ** 2
        E_rest = 0.0
    else:
        E_w = 0.5 * M * V_w ** 2
        E_rest = 0.5 * erg["m_rest"] * erg["v_rest"] ** 2 if erg["ergebnis"] != "Projektil vollständig aufgezehrt" else 0.0
    E_frag = erg.get("E_fragmente", 0.0)
    erg["E_rest"] = E_rest
    erg["E_wuerfel"] = E_w
    erg["E_dissipiert"] = erg["E_aufprall"] - E_rest - E_w - E_frag if erg["getroffen"] else 0.0


def zusammenfassung(erg):
    """Menschenlesbare Ergebniszeilen."""
    z = [
        f"Ergebnis: {erg['ergebnis']}",
        f"Projektilmasse: {erg['masse'] * 1e3:.2f} g",
        f"Aufprallgeschwindigkeit: {erg['v_aufprall']:.1f} m/s",
        f"Aufprallenergie: {erg['E_aufprall'] / 1e3:.3f} kJ",
    ]
    if erg["getroffen"]:
        z.append(f"Kontaktspannung (ebene Welle): {erg['kontaktspannung'] / 1e9:.2f} GPa")
        z.append(f"Zielwiderstand R_t: {erg['R_t'] / 1e9:.2f} GPa")
        z.append("Regime: " + " → ".join(erg["regime"]))
    if erg.get("kontaktzeit"):
        z.append(f"Kontaktzeit: {erg['kontaktzeit'] * 1e6:.2f} µs, "
                 f"max. Annäherung: {erg['max_annaeherung'] * 1e6:.1f} µm")
    if erg.get("u_start") is not None:
        z.append(f"Eindringgeschw. u (Beginn): {erg['u_start']:.0f} m/s")
        z.append(f"Eindringtiefe: {erg['eindringtiefe'] * 1e3:.2f} mm "
                 f"(P/L = {erg['eindringtiefe'] / erg['L_eq']:.2f})")
        if erg["kraterdurchmesser"] > 0:
            z.append(f"Kraterdurchmesser (Eingang): {erg['kraterdurchmesser'] * 1e3:.2f} mm")
        z.append(f"Eindringdauer: {(erg['t_ende'] - erg['t_aufprall']) * 1e6:.1f} µs")
    if erg["getroffen"]:
        if erg["m_rest"] > 0:
            z.append(f"Restmasse: {erg['m_rest'] * 1e3:.2f} g, Restgeschw.: {erg['v_rest']:.1f} m/s")
        z.append(f"Würfelgeschwindigkeit: {_norm(erg['v_wuerfel']):.3f} m/s")
        z.append(f"Dissipierte Energie (Wärme, Verformung): {erg['E_dissipiert'] / 1e3:.3f} kJ")
    return z


# ---------------------------------------------------------------------------
# Blender-Teil
# ---------------------------------------------------------------------------
PRAEFIX = "BAL_"
SAMMLUNG = "Ballistik"


def _material_items(self, context):
    return [(k, v[0], "") for k, v in MATERIALIEN.items()] + [("CUSTOM", "Benutzerdefiniert", "")]


def _setze_proj_material(self, context):
    if self.proj_material in MATERIALIEN:
        _, rho, Y, E, nu, *_ = MATERIALIEN[self.proj_material]
        self.proj_dichte, self.proj_fliessgrenze_mpa = rho, Y / 1e6
        self.proj_emodul_gpa, self.proj_poisson = E / 1e9, nu


def _setze_ziel_material(self, context):
    if self.ziel_material in MATERIALIEN:
        _, rho, Y, E, nu, *_ = MATERIALIEN[self.ziel_material]
        self.ziel_dichte, self.ziel_fliessgrenze_mpa = rho, Y / 1e6
        self.ziel_emodul_gpa, self.ziel_poisson = E / 1e9, nu


if bpy is not None:
    from bpy.props import (BoolProperty, EnumProperty, FloatProperty, IntProperty,
                           PointerProperty)

    class BallistikEinstellungen(bpy.types.PropertyGroup):
        # Projektil
        proj_material: EnumProperty(name="Werkstoff", items=_material_items,
                                    update=_setze_proj_material, default=1)
        proj_dichte: FloatProperty(name="Dichte (kg/m³)", default=17600.0, min=100.0)
        proj_fliessgrenze_mpa: FloatProperty(name="Dyn. Fließgrenze (MPa)", default=1200.0, min=1.0)
        proj_emodul_gpa: FloatProperty(name="E-Modul (GPa)", default=360.0, min=0.1)
        proj_poisson: FloatProperty(name="Querkontraktion ν", default=0.29, min=0.0, max=0.499)
        proj_durchmesser_mm: FloatProperty(name="Durchmesser (mm)", default=10.0, min=0.1)
        proj_laenge_mm: FloatProperty(name="Länge (mm)", default=60.0, min=0.1)
        proj_spitze_kaliber: FloatProperty(name="Spitzenlänge (Kaliber)", default=1.5, min=0.0, max=5.0,
                                           description="0 = Flachkopf, ≥0,5 = Ogive")
        geschwindigkeit: FloatProperty(name="Geschwindigkeit (m/s)", default=1500.0, min=0.1)
        elevation_grad: FloatProperty(name="Elevation (°)", default=0.0, min=-45.0, max=45.0)
        azimut_grad: FloatProperty(name="Azimut (°)", default=0.0, min=-45.0, max=45.0)
        # Ziel
        ziel_material: EnumProperty(name="Werkstoff", items=_material_items,
                                    update=_setze_ziel_material, default=0)
        ziel_dichte: FloatProperty(name="Dichte (kg/m³)", default=19250.0, min=100.0)
        ziel_fliessgrenze_mpa: FloatProperty(name="Dyn. Fließgrenze (MPa)", default=1500.0, min=1.0)
        ziel_emodul_gpa: FloatProperty(name="E-Modul (GPa)", default=411.0, min=0.1)
        ziel_poisson: FloatProperty(name="Querkontraktion ν", default=0.28, min=0.0, max=0.499)
        wuerfel_kante_mm: FloatProperty(name="Kantenlänge (mm)", default=100.0, min=1.0)
        rt_auto: BoolProperty(name="R_t automatisch (Tate)", default=True)
        rt_mpa: FloatProperty(name="Zielwiderstand R_t (MPa)", default=8000.0, min=1.0)
        wuerfel_frei: BoolProperty(name="Würfel frei gelagert (Impuls)", default=True)
        schnittansicht: BoolProperty(name="Schnittansicht (halber Würfel)", default=True)
        # Umgebung
        abstand_m: FloatProperty(name="Startabstand (m)", default=0.3, min=0.001)
        gravitation: FloatProperty(name="Gravitation (m/s²)", default=9.81, min=0.0)
        luftdichte: FloatProperty(name="Luftdichte (kg/m³)", default=1.225, min=0.0)
        cw: FloatProperty(name="Widerstandsbeiwert c_w", default=0.30, min=0.0)
        stosszahl: FloatProperty(name="Stoßzahl e (elastisch)", default=0.6, min=0.0, max=1.0)
        # Animation
        fragmente: IntProperty(name="Splitteranzahl", default=40, min=0, max=500)
        seed: IntProperty(name="Zufallsstartwert", default=1)
        nachlauf_us: FloatProperty(name="Nachlaufzeit (µs)", default=300.0, min=0.0)
        frames_flug: IntProperty(name="Frames Flug", default=48, min=1)
        frames_einschlag: IntProperty(name="Frames Einschlag", default=120, min=1)
        frames_nachlauf: IntProperty(name="Frames Nachlauf", default=72, min=1)
        fps: IntProperty(name="Bildrate (fps)", default=24, min=1)

        def parameter(self):
            return Parameter(
                proj_dichte=self.proj_dichte, proj_fliessgrenze=self.proj_fliessgrenze_mpa * 1e6,
                proj_emodul=self.proj_emodul_gpa * 1e9, proj_poisson=self.proj_poisson,
                proj_durchmesser=self.proj_durchmesser_mm / 1e3, proj_laenge=self.proj_laenge_mm / 1e3,
                proj_spitze_kaliber=self.proj_spitze_kaliber, geschwindigkeit=self.geschwindigkeit,
                elevation_grad=self.elevation_grad, azimut_grad=self.azimut_grad,
                ziel_dichte=self.ziel_dichte, ziel_fliessgrenze=self.ziel_fliessgrenze_mpa * 1e6,
                ziel_emodul=self.ziel_emodul_gpa * 1e9, ziel_poisson=self.ziel_poisson,
                wuerfel_kante=self.wuerfel_kante_mm / 1e3,
                ziel_widerstand=0.0 if self.rt_auto else self.rt_mpa * 1e6,
                wuerfel_frei=self.wuerfel_frei, abstand=self.abstand_m, gravitation=self.gravitation,
                luftdichte=self.luftdichte, cw=self.cw, stosszahl=self.stosszahl,
                fragmente=self.fragmente, seed=self.seed, nachlauf=self.nachlauf_us * 1e-6)


def _blender_material(name, farbe, metallisch, rauheit):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*farbe, 1.0)
        bsdf.inputs["Metallic"].default_value = metallisch
        bsdf.inputs["Roughness"].default_value = rauheit
    mat.diffuse_color = (*farbe, 1.0)
    return mat


def _rotationskoerper(name, profil, segmente=48):
    """Mesh aus Profil [(x, r)] mit streng steigendem x (r = 0 -> Pol)."""
    verts, faces, ringe = [], [], []
    for x, r in profil:
        if r <= 1e-12:
            ringe.append(("pol", len(verts)))
            verts.append((x, 0.0, 0.0))
        else:
            ringe.append(("ring", len(verts)))
            for k in range(segmente):
                # halbe Segmentversetzung: keine Vertices exakt in der Schnittebene y = 0
                phi = 2 * math.pi * (k + 0.5) / segmente
                verts.append((x, r * math.cos(phi), r * math.sin(phi)))
    for (ta, ia), (tb, ib) in zip(ringe, ringe[1:]):
        for k in range(segmente):
            k1 = (k + 1) % segmente
            if ta == "ring" and tb == "ring":
                faces.append((ia + k, ia + k1, ib + k1, ib + k))
            elif ta == "ring":
                faces.append((ia + k, ia + k1, ib))
            elif tb == "ring":
                faces.append((ia, ib + k1, ib + k))
    if ringe[0][0] == "ring":
        faces.append(tuple(ringe[0][1] + k for k in reversed(range(segmente))))
    if ringe[-1][0] == "ring":
        faces.append(tuple(ringe[-1][1] + k for k in range(segmente)))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    for poly in me.polygons:
        poly.use_smooth = True
    return me


def _quader(name, x0, x1, y0, y1, z0, z1):
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(v, [], f)
    me.update()
    return me


def _objekt(name, data, sammlung):
    ob = bpy.data.objects.new(name, data)
    sammlung.objects.link(ob)
    return ob


def _aufraeumen(scene):
    coll = bpy.data.collections.get(SAMMLUNG)
    if coll:
        for ob in list(coll.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.collections.remove(coll)
    for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.cameras, bpy.data.lights, bpy.data.actions):
        for blk in list(blocks):
            if blk.name.startswith(PRAEFIX) and blk.users == 0:
                blocks.remove(blk)
    coll = bpy.data.collections.new(SAMMLUNG)
    scene.collection.children.link(coll)
    return coll


class _Zeitachse:
    """Stückweise lineare Zuordnung Frame <-> physikalische Zeit je Phase."""

    def __init__(self, phasen, start=1):
        self.segmente = []
        f = start
        for t0, t1, n in phasen:
            if t1 > t0 and n > 0:
                self.segmente.append((f, f + n, t0, t1))
                f += n
        self.start, self.ende = start, f

    def zeit(self, frame):
        for f0, f1, t0, t1 in self.segmente:
            if frame <= f1:
                return t0 + (t1 - t0) * max(frame - f0, 0) / (f1 - f0)
        return self.segmente[-1][3] if self.segmente else 0.0


def _interpoliere(zr, t):
    ts = zr["t"]
    i = bisect.bisect_right(ts, t)
    if i <= 0:
        j = 0
        f = 0.0
    elif i >= len(ts):
        j, f = len(ts) - 2, 1.0
    else:
        j = i - 1
        dt = ts[i] - ts[j]
        f = (t - ts[j]) / dt if dt > 0 else 1.0
    j = max(j, 0)
    k = min(j + 1, len(ts) - 1)
    num = lambda key: None if zr[key][j] is None or zr[key][k] is None else \
        zr[key][j] + (zr[key][k] - zr[key][j]) * f
    return {
        "spitze": _lerp(zr["spitze"][j], zr["spitze"][k], f),
        "richtung": _unit(_lerp(zr["richtung"][j], zr["richtung"][k], f)),
        "lrel": num("lrel"), "v": num("v"), "u": num("u"), "P": num("P"),
        "sichtbar": zr["sichtbar"][k] if f > 0.5 else zr["sichtbar"][j],
        "phase": zr["phase"][k] if f > 0.5 else zr["phase"][j],
    }


def _zeit_text(t):
    return f"{t * 1e3:.3f} ms" if t >= 1e-3 else f"{t * 1e6:.2f} µs"


def baue_szene(context, prm, erg, e):
    """Erzeugt Objekte, Materialien, Kamera, Licht und alle Keyframes."""
    scene = context.scene
    coll = _aufraeumen(scene)
    a = prm.wuerfel_kante
    R = prm.proj_durchmesser / 2
    prefs = context.preferences.edit
    alte_interp = prefs.keyframe_new_interpolation_type
    prefs.keyframe_new_interpolation_type = "LINEAR"

    try:
        scene.unit_settings.system = "METRIC"
        scene.unit_settings.length_unit = "MILLIMETERS"

        # Materialien
        pf = MATERIALIEN.get(e.proj_material, (None, 0, 0, 0, 0, (0.6, 0.6, 0.6), 1.0, 0.4))
        zf = MATERIALIEN.get(e.ziel_material, MATERIALIEN["W"])
        mat_p = _blender_material(PRAEFIX + "Projektil", *pf[5:8])
        mat_t = _blender_material(PRAEFIX + "Ziel", *zf[5:8])
        mat_boden = _blender_material(PRAEFIX + "Boden", (0.08, 0.08, 0.09), 0.0, 0.8)

        # Würfel (Vorderseite bei x = 0)
        wuerfel = _objekt(PRAEFIX + "Wolframwuerfel",
                          _quader(PRAEFIX + "Wuerfel", -a / 2, a / 2, -a / 2, a / 2, -a / 2, a / 2), coll)
        wuerfel.data.materials.append(mat_t)
        c0 = (a / 2, 0.0, 0.0)
        wuerfel.location = c0

        # Boden
        boden = _objekt(PRAEFIX + "Boden", _quader(PRAEFIX + "Boden", -2, 2, -2, 2, -a / 2 - 0.002, -a / 2), coll)
        boden.data.materials.append(mat_boden)

        # Projektil (Ursprung am Heck, Längsachse +X)
        proj = _objekt(PRAEFIX + "Projektil", _rotationskoerper(PRAEFIX + "Projektil", projektil_profil(prm)), coll)
        proj.data.materials.append(mat_p)
        proj.rotation_mode = "QUATERNION"

        # Krater-Schneidkörper (per Boolean vom Würfel abgezogen)
        d = erg["d"]
        krater_obj = None
        if erg["krater"]:
            eps = 0.05 * a
            prof = [(p, r) for p, r in erg["krater"]]
            P_end = prof[-1][0]
            schritt = max(1, len(prof) // 80)
            prof = prof[::schritt] + ([prof[-1]] if (len(prof) - 1) % schritt else [])
            if erg["ergebnis"] == "Durchschuss":
                prof.append((P_end + 2 * eps, prof[-1][1]))
                s_boden = P_end + 2 * eps
            else:  # halbkugeliger Kratergrund knapp vor der Spitze
                rk = prof[-1][1]
                zentrum = P_end + 0.02 * R - rk
                prof = [q for q in prof if q[0] < zentrum - 1e-9] or [prof[0]]
                for i in range(1, 9):
                    th = math.pi / 2 * i / 8
                    prof.append((zentrum + rk * math.sin(th), rk * math.cos(th) if i < 8 else 0.0))
                s_boden = P_end + 0.02 * R
            prof = [(-eps, prof[0][1])] + prof
            lokal = [(s + eps, r) for s, r in prof]
            krater_obj = _objekt(PRAEFIX + "Krater", _rotationskoerper(PRAEFIX + "Krater", lokal, 48), coll)
            krater_obj.display_type = "WIRE"
            krater_obj.hide_render = True
            krater_obj.parent = wuerfel
            krater_obj.rotation_mode = "QUATERNION"
            krater_obj.rotation_quaternion = Vector(d).to_track_quat("X", "Z")
            krater_obj.location = Vector(_sub(_sub(erg["p_aufprall"], _mul(d, eps)), c0))
            mod = wuerfel.modifiers.new("Krater", "BOOLEAN")
            mod.operation = "DIFFERENCE"
            mod.object = krater_obj
            mod.solver = "EXACT"

        if e.schnittansicht:
            schnitt = _objekt(PRAEFIX + "Schnitt",
                              _quader(PRAEFIX + "Schnitt", -a, a, -a, 0.0, -a, a), coll)
            schnitt.display_type = "WIRE"
            schnitt.hide_render = True
            schnitt.parent = wuerfel
            schnitt.location = (0.0, 0.0, 0.0)
            mod_s = wuerfel.modifiers.new("Schnittansicht", "BOOLEAN")
            mod_s.operation = "DIFFERENCE"
            mod_s.object = schnitt
            mod_s.solver = "EXACT"

        # Splitter
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
        me_frag = bpy.data.meshes.new(PRAEFIX + "Splitter")
        bm.to_mesh(me_frag)
        bm.free()
        me_frag.materials.append(mat_p)
        rng = random.Random(prm.seed + 17)
        frag_obj = []
        for i, fr in enumerate(erg["fragmente"]):
            ob = _objekt(f"{PRAEFIX}Splitter_{i:03d}", me_frag, coll)
            ob.material_slots[0].link = "OBJECT"
            ob.material_slots[0].material = mat_p if fr["quelle"] == "projektil" else mat_t
            form = (rng.uniform(0.6, 1.4), rng.uniform(0.6, 1.4), rng.uniform(0.6, 1.4))
            k = fr["radius"] / (form[0] * form[1] * form[2]) ** (1 / 3)
            ob.rotation_euler = (rng.uniform(0, 6.3), rng.uniform(0, 6.3), rng.uniform(0, 6.3))
            frag_obj.append((ob, fr, tuple(f * k for f in form)))

        # Zeitachse
        zr = erg["zeitreihe"]
        t_imp, t_end, t_sim = erg["t_aufprall"], erg["t_ende"], erg["t_sim_ende"]
        achse = _Zeitachse([(0.0, t_imp, e.frames_flug), (t_imp, t_end, e.frames_einschlag),
                            (t_end, t_sim, e.frames_nachlauf)])
        scene.frame_start, scene.frame_end = achse.start, achse.ende
        scene.render.fps = e.fps

        V_w = erg["v_wuerfel"]
        g = (0.0, 0.0, -prm.gravitation)
        hud = []
        P_boden = erg["krater"][-1][0] if erg["krater"] else 0.0
        for frame in range(achse.start, achse.ende + 1):
            t = achse.zeit(frame)
            z = _interpoliere(zr, t)
            L_vis = prm.proj_laenge * max(z["lrel"], 0.0)
            proj.location = Vector(_sub(z["spitze"], _mul(z["richtung"], L_vis)))
            proj.rotation_quaternion = Vector(z["richtung"]).to_track_quat("X", "Z")
            proj.scale = (max(z["lrel"], 0.0), 1.0, 1.0) if z["sichtbar"] else (0.0, 0.0, 0.0)
            for pfad in ("location", "rotation_quaternion", "scale"):
                proj.keyframe_insert(pfad, frame=frame)

            tau = max(t - t_end, 0.0) if erg["getroffen"] else 0.0
            wuerfel.location = Vector(_add(c0, _mul(V_w, tau)))
            wuerfel.keyframe_insert("location", frame=frame)

            if krater_obj is not None:
                P = z["P"] if z["phase"] not in (FLUG,) and z["P"] is not None else 0.0
                if t >= t_end:
                    P = P_boden
                aktiv = t > t_imp and P > 1e-4 * a
                k = (P + eps) / (s_boden + eps) if aktiv else 1e-3
                if t >= t_end:
                    k = 1.0
                krater_obj.scale = (min(k, 1.0), 1.0, 1.0)
                krater_obj.keyframe_insert("scale", frame=frame)
                mod.show_viewport = mod.show_render = aktiv
                mod.keyframe_insert("show_viewport", frame=frame)
                mod.keyframe_insert("show_render", frame=frame)

            for ob, fr, skal in frag_obj:
                tau = t - fr["t0"]
                if tau < 0:
                    ob.location = Vector(fr["pos"])
                    ob.scale = (0.0, 0.0, 0.0)
                else:
                    ob.location = Vector(_add(_add(fr["pos"], _mul(fr["vel"], tau)), _mul(g, 0.5 * tau * tau)))
                    ob.scale = skal
                ob.keyframe_insert("location", frame=frame)
                ob.keyframe_insert("scale", frame=frame)

            zeilen = [f"t = {_zeit_text(t)}   (Frame {frame})", f"Phase: {z['phase']}",
                      f"v = {z['v']:.1f} m/s" + (f"   u = {z['u']:.1f} m/s" if z["u"] is not None else "")]
            if erg["getroffen"] and t >= t_imp:
                zeilen.append(f"Restlänge = {L_vis * 1e3:.1f} mm   Eindringtiefe = {(z['P'] or 0) * 1e3:.2f} mm")
            if t >= t_end and erg["getroffen"]:
                zeilen.append(f"Ergebnis: {erg['ergebnis']}")
            hud.append("\n".join(zeilen))

        # Kamera, Licht, Welt
        ziel_leer = bpy.data.objects.new(PRAEFIX + "Kameraziel", None)
        coll.objects.link(ziel_leer)
        ziel_leer.location = (0.3 * a, 0.0, -0.05 * a)
        cam_data = bpy.data.cameras.new(PRAEFIX + "Kamera")
        cam_data.lens = 50
        cam_data.clip_start = a * 0.005
        cam_data.clip_end = 100
        cam = _objekt(PRAEFIX + "Kamera", cam_data, coll)
        cam.location = (-1.0 * a, -2.6 * a, 1.1 * a)
        c = cam.constraints.new("TRACK_TO")
        c.target = ziel_leer
        c.track_axis = "TRACK_NEGATIVE_Z"
        c.up_axis = "UP_Y"
        scene.camera = cam
        if scene.world is None:
            scene.world = bpy.data.worlds.new(PRAEFIX + "Welt")
            scene.world.color = (0.12, 0.12, 0.13)

        sonne = _objekt(PRAEFIX + "Sonne", bpy.data.lights.new(PRAEFIX + "Sonne", "SUN"), coll)
        sonne.data.energy = 2.0
        sonne.rotation_euler = (math.radians(50), math.radians(10), math.radians(-40))
        flaeche = _objekt(PRAEFIX + "Flaechenlicht", bpy.data.lights.new(PRAEFIX + "Flaechenlicht", "AREA"), coll)
        flaeche.data.energy = 15 * (a / 0.1) ** 2
        flaeche.data.size = 2 * a
        flaeche.location = (-2 * a, -2 * a, 3 * a)
        flaeche.constraints.new("TRACK_TO").target = ziel_leer

        # HUD-Text (an Kamera gehängt)
        txt_data = bpy.data.curves.new(PRAEFIX + "HUD", "FONT")
        D = 0.5 * a                     # dicht vor der Kamera, damit nichts verdeckt
        txt_data.size = 0.02 * D
        txt = _objekt(PRAEFIX + "HUD", txt_data, coll)
        txt.parent = cam
        txt.location = (-0.34 * D, 0.17 * D, -D)
        mat_txt = _blender_material(PRAEFIX + "HUD", (1.0, 0.85, 0.3), 0.0, 1.0)
        txt_data.materials.append(mat_txt)
        bsdf = mat_txt.node_tree.nodes.get("Principled BSDF")
        if bsdf:  # Eingangsnamen unterscheiden sich zwischen Blender 3.x und 4.x
            for name in ("Emission Color", "Emission"):
                if name in bsdf.inputs:
                    bsdf.inputs[name].default_value = (1.0, 0.85, 0.3, 1.0)
                    break
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = 3.0
        txt_data.body = hud[0]

        scene["ballistik_hud"] = json.dumps(hud)
        scene["ballistik_ergebnis"] = json.dumps(zusammenfassung(erg))
        scene.frame_set(achse.start)

        # Viewport-Clipping für Millimeterobjekte
        for screen in bpy.data.screens:
            for area in screen.areas:
                if area.type == "VIEW_3D":
                    for space in area.spaces:
                        if space.type == "VIEW_3D":
                            space.clip_start = min(space.clip_start, a * 0.005)
    finally:
        prefs.keyframe_new_interpolation_type = alte_interp
    return coll


@persistent
def _hud_aktualisieren(scene, *args):
    daten = scene.get("ballistik_hud")
    ob = bpy.data.objects.get(PRAEFIX + "HUD")
    if not daten or ob is None:
        return
    zeilen = json.loads(daten)
    i = min(max(scene.frame_current - scene.frame_start, 0), len(zeilen) - 1)
    if ob.data.body != zeilen[i]:
        ob.data.body = zeilen[i]


if bpy is not None:

    class BALLISTIK_OT_simulieren(bpy.types.Operator):
        """Physik berechnen und Szene (Objekte, Krater, Splitter, Animation) neu erzeugen"""
        bl_idname = "ballistik.simulieren"
        bl_label = "Simulation berechnen"
        bl_options = {"REGISTER", "UNDO"}

        def execute(self, context):
            e = context.scene.ballistik
            prm = e.parameter()
            erg = simuliere(prm)
            baue_szene(context, prm, erg, e)
            self.report({"INFO"}, f"{erg['ergebnis']} – v_Aufprall {erg['v_aufprall']:.0f} m/s, "
                                  f"Eindringtiefe {erg['eindringtiefe'] * 1e3:.1f} mm")
            return {"FINISHED"}

    class _Panel:
        bl_space_type = "VIEW_3D"
        bl_region_type = "UI"
        bl_category = "Ballistik"

    class BALLISTIK_PT_haupt(_Panel, bpy.types.Panel):
        bl_label = "Projektil → Wolframwürfel"

        def draw(self, context):
            col = self.layout.column()
            col.scale_y = 1.4
            col.operator("ballistik.simulieren", icon="PHYSICS")

    class BALLISTIK_PT_projektil(_Panel, bpy.types.Panel):
        bl_label = "Projektil"
        bl_parent_id = "BALLISTIK_PT_haupt"

        def draw(self, context):
            e, col = context.scene.ballistik, self.layout.column(align=True)
            col.prop(e, "proj_material")
            for p in ("proj_dichte", "proj_fliessgrenze_mpa", "proj_emodul_gpa", "proj_poisson"):
                col.prop(e, p)
            col.separator()
            for p in ("proj_durchmesser_mm", "proj_laenge_mm", "proj_spitze_kaliber"):
                col.prop(e, p)
            col.separator()
            for p in ("geschwindigkeit", "elevation_grad", "azimut_grad"):
                col.prop(e, p)

    class BALLISTIK_PT_ziel(_Panel, bpy.types.Panel):
        bl_label = "Ziel (Würfel)"
        bl_parent_id = "BALLISTIK_PT_haupt"

        def draw(self, context):
            e, col = context.scene.ballistik, self.layout.column(align=True)
            col.prop(e, "ziel_material")
            for p in ("ziel_dichte", "ziel_fliessgrenze_mpa", "ziel_emodul_gpa", "ziel_poisson",
                      "wuerfel_kante_mm"):
                col.prop(e, p)
            col.separator()
            col.prop(e, "rt_auto")
            sub = col.row()
            sub.enabled = not e.rt_auto
            sub.prop(e, "rt_mpa")
            col.prop(e, "wuerfel_frei")
            col.prop(e, "schnittansicht")

    class BALLISTIK_PT_umgebung(_Panel, bpy.types.Panel):
        bl_label = "Flug & Stoß"
        bl_parent_id = "BALLISTIK_PT_haupt"
        bl_options = {"DEFAULT_CLOSED"}

        def draw(self, context):
            e, col = context.scene.ballistik, self.layout.column(align=True)
            for p in ("abstand_m", "gravitation", "luftdichte", "cw", "stosszahl"):
                col.prop(e, p)

    class BALLISTIK_PT_animation(_Panel, bpy.types.Panel):
        bl_label = "Animation"
        bl_parent_id = "BALLISTIK_PT_haupt"
        bl_options = {"DEFAULT_CLOSED"}

        def draw(self, context):
            e, col = context.scene.ballistik, self.layout.column(align=True)
            for p in ("frames_flug", "frames_einschlag", "frames_nachlauf", "fps", "nachlauf_us",
                      "fragmente", "seed"):
                col.prop(e, p)

    class BALLISTIK_PT_ergebnis(_Panel, bpy.types.Panel):
        bl_label = "Ergebnisse"
        bl_parent_id = "BALLISTIK_PT_haupt"

        def draw(self, context):
            daten = context.scene.get("ballistik_ergebnis")
            col = self.layout.column(align=True)
            if not daten:
                col.label(text="Noch keine Simulation berechnet.")
                return
            for zeile in json.loads(daten):
                col.label(text=zeile)

    KLASSEN = (BallistikEinstellungen, BALLISTIK_OT_simulieren, BALLISTIK_PT_haupt,
               BALLISTIK_PT_projektil, BALLISTIK_PT_ziel, BALLISTIK_PT_umgebung,
               BALLISTIK_PT_animation, BALLISTIK_PT_ergebnis)


def register():
    for k in KLASSEN:
        bpy.utils.register_class(k)
    bpy.types.Scene.ballistik = PointerProperty(type=BallistikEinstellungen)
    handler = bpy.app.handlers.frame_change_pre
    for h in [h for h in handler if getattr(h, "__name__", "") == "_hud_aktualisieren"]:
        handler.remove(h)
    handler.append(_hud_aktualisieren)


def unregister():
    handler = bpy.app.handlers.frame_change_pre
    for h in [h for h in handler if getattr(h, "__name__", "") == "_hud_aktualisieren"]:
        handler.remove(h)
    del bpy.types.Scene.ballistik
    for k in reversed(KLASSEN):
        bpy.utils.unregister_class(k)


# ---------------------------------------------------------------------------
# Kommandozeile
#   Blender:  blender -b -P projektil_wolframwuerfel.py -- --geschwindigkeit 1700 --speichern szene.blend
#   Python:   python3 projektil_wolframwuerfel.py --geschwindigkeit 400 --proj-material PB
# ---------------------------------------------------------------------------
def _cli_argumente(argv):
    import argparse
    ap = argparse.ArgumentParser(description="Projektil gegen Wolframwürfel")
    for f in fields(Parameter):
        typ = {float: float, int: int, bool: str, "float": float, "int": int, "bool": str}[f.type]
        ap.add_argument("--" + f.name.replace("_", "-"), type=typ)
    ap.add_argument("--proj-material", choices=list(MATERIALIEN))
    ap.add_argument("--ziel-material", choices=list(MATERIALIEN))
    ap.add_argument("--speichern", help="Pfad für .blend-Datei (nur in Blender)")
    ns = ap.parse_args(argv)
    prm = Parameter()
    if ns.proj_material:
        _, prm.proj_dichte, prm.proj_fliessgrenze, prm.proj_emodul, prm.proj_poisson, *_ = MATERIALIEN[ns.proj_material]
    if ns.ziel_material:
        _, prm.ziel_dichte, prm.ziel_fliessgrenze, prm.ziel_emodul, prm.ziel_poisson, *_ = MATERIALIEN[ns.ziel_material]
    for f in fields(Parameter):
        wert = getattr(ns, f.name)
        if wert is not None:
            if isinstance(getattr(prm, f.name), bool):
                wert = str(wert).lower() in ("1", "true", "ja", "yes")
            setattr(prm, f.name, wert)
    return prm, ns


def _uebertrage_in_panel(e, prm, ns):
    if ns.proj_material:
        e.proj_material = ns.proj_material
    if ns.ziel_material:
        e.ziel_material = ns.ziel_material
    e.proj_dichte, e.proj_fliessgrenze_mpa = prm.proj_dichte, prm.proj_fliessgrenze / 1e6
    e.proj_emodul_gpa, e.proj_poisson = prm.proj_emodul / 1e9, prm.proj_poisson
    e.proj_durchmesser_mm, e.proj_laenge_mm = prm.proj_durchmesser * 1e3, prm.proj_laenge * 1e3
    e.proj_spitze_kaliber, e.geschwindigkeit = prm.proj_spitze_kaliber, prm.geschwindigkeit
    e.elevation_grad, e.azimut_grad = prm.elevation_grad, prm.azimut_grad
    e.ziel_dichte, e.ziel_fliessgrenze_mpa = prm.ziel_dichte, prm.ziel_fliessgrenze / 1e6
    e.ziel_emodul_gpa, e.ziel_poisson = prm.ziel_emodul / 1e9, prm.ziel_poisson
    e.wuerfel_kante_mm = prm.wuerfel_kante * 1e3
    e.rt_auto = prm.ziel_widerstand <= 0
    if not e.rt_auto:
        e.rt_mpa = prm.ziel_widerstand / 1e6
    e.wuerfel_frei, e.abstand_m, e.gravitation = prm.wuerfel_frei, prm.abstand, prm.gravitation
    e.luftdichte, e.cw, e.stosszahl = prm.luftdichte, prm.cw, prm.stosszahl
    e.fragmente, e.seed, e.nachlauf_us = prm.fragmente, prm.seed, prm.nachlauf * 1e6


if __name__ == "__main__":
    if bpy is None:
        prm, _ = _cli_argumente(sys.argv[1:])
        erg = simuliere(prm)
        print("\n".join(zusammenfassung(erg)))
    else:
        register()
        if "--" in sys.argv:
            prm, ns = _cli_argumente(sys.argv[sys.argv.index("--") + 1:])
            e = bpy.context.scene.ballistik
            _uebertrage_in_panel(e, prm, ns)
            erg = simuliere(e.parameter())
            baue_szene(bpy.context, e.parameter(), erg, e)
            print("\n".join(zusammenfassung(erg)))
            if ns.speichern:
                bpy.ops.wm.save_as_mainfile(filepath=ns.speichern)
