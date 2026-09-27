"""Tests der Physik (ohne Blender):  python3 -m unittest discover -s blender/tests"""
import importlib.util
import math
import os
import sys
import unittest

sys.modules["bpy"] = None  # Physik muss ohne Blender laufen
_PFAD = os.path.join(os.path.dirname(__file__), "..", "projektil_wolframwuerfel.py")
_spec = importlib.util.spec_from_file_location("bal", _PFAD)
bal = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bal)
P = bal.Parameter


def mit_material(prm, proj=None, ziel=None):
    if proj:
        _, prm.proj_dichte, prm.proj_fliessgrenze, prm.proj_emodul, prm.proj_poisson, *_ = bal.MATERIALIEN[proj]
    if ziel:
        _, prm.ziel_dichte, prm.ziel_fliessgrenze, prm.ziel_emodul, prm.ziel_poisson, *_ = bal.MATERIALIEN[ziel]
    return prm


class Grenzflaeche(unittest.TestCase):
    def test_bernoulli_bilanz(self):
        rp, rt, Yp, Rt = 17600, 19250, 1.2e9, 8.6e9
        for v in (1200.0, 1800.0, 3000.0):
            u, reg = bal.grenzflaechengeschwindigkeit(v, rp, rt, Yp, Rt)
            self.assertEqual(reg, bal.EROSION)
            links = 0.5 * rp * (v - u) ** 2 + Yp
            rechts = 0.5 * rt * u ** 2 + Rt
            self.assertAlmostEqual(links / rechts, 1.0, places=9)

    def test_hydrodynamischer_grenzfall(self):
        rp, rt, v = 17600, 7850, 3000.0
        u, _ = bal.grenzflaechengeschwindigkeit(v, rp, rt, 0.0, 0.0)
        self.assertAlmostEqual(u, v / (1 + math.sqrt(rt / rp)), places=6)

    def test_gleiche_dichte(self):
        u, _ = bal.grenzflaechengeschwindigkeit(2000.0, 19250, 19250, 1e9, 5e9)
        self.assertAlmostEqual(u, 1000.0 - 4e9 / (19250 * 2000.0), places=6)

    def test_grenzregime(self):
        self.assertEqual(bal.grenzflaechengeschwindigkeit(300, 11340, 19250, 3e7, 8e9)[1], bal.OBERFLAECHE)
        self.assertEqual(bal.grenzflaechengeschwindigkeit(500, 15600, 2810, 4e9, 2e9)[1], bal.STARR)


class Geometrie(unittest.TestCase):
    def test_zylindervolumen(self):
        prm = P(proj_spitze_kaliber=0.0)
        R = prm.proj_durchmesser / 2
        V = bal.profil_volumen(bal.projektil_profil(prm))
        self.assertAlmostEqual(V, math.pi * R * R * prm.proj_laenge, delta=1e-12)

    def test_ogive_endet_spitz_und_ist_kleiner(self):
        prm = P(proj_spitze_kaliber=1.5)
        prof = bal.projektil_profil(prm)
        self.assertEqual(prof[-1], (prm.proj_laenge, 0.0))
        self.assertTrue(all(b[0] > a[0] for a, b in zip(prof, prof[1:])))
        V = bal.profil_volumen(prof)
        self.assertLess(V, math.pi * (prm.proj_durchmesser / 2) ** 2 * prm.proj_laenge)


class Flug(unittest.TestCase):
    def test_freier_fall_ohne_luft(self):
        prm = P(luftdichte=0.0, geschwindigkeit=300.0, abstand=3.0, wuerfel_kante=1.0)
        erg = bal.simuliere(prm)
        t = erg["t_aufprall"]
        self.assertAlmostEqual(t, 3.0 / 300.0, places=9)
        self.assertAlmostEqual(erg["p_aufprall"][2], -0.5 * 9.81 * t * t, places=9)

    def test_luftwiderstand_bremst(self):
        erg = bal.simuliere(P(abstand=50.0, wuerfel_kante=1.0))
        self.assertLess(erg["v_aufprall"], 1500.0)
        self.assertGreater(erg["v_aufprall"], 1400.0)

    def test_verfehlt(self):
        self.assertEqual(bal.simuliere(P(elevation_grad=20.0))["ergebnis"], "Verfehlt")


class Einschlag(unittest.TestCase):
    def _impulsbilanz(self, erg):
        p_ein = bal._mul(erg["d"], erg["masse"] * erg["v_aufprall"])
        p_frag = (0.0, 0.0, 0.0)
        for f in erg["fragmente"]:
            p_frag = bal._add(p_frag, bal._mul(f["vel"], f["masse"]))
        M = erg["M_wuerfel_rest"]
        if erg["rest_frei"]:
            p_aus = bal._add(bal._add(p_frag, bal._mul(erg["v_wuerfel"], M)),
                             bal._mul(erg["d"], erg["m_rest"] * erg["v_rest"]))
        else:
            p_aus = bal._add(p_frag, bal._mul(erg["v_wuerfel"], M + erg["m_rest"]))
        for a, b in zip(p_ein, p_aus):
            self.assertAlmostEqual(a, b, delta=1e-9 * abs(p_ein[0]))

    def test_standard_erosion(self):
        erg = bal.simuliere(P())
        self.assertEqual(erg["regime"][0], bal.EROSION)
        self.assertGreater(erg["eindringtiefe"], 0.0)
        self.assertLess(erg["eindringtiefe"], erg["L_eq"])       # W-Ziel ist dichter/fester
        self.assertGreater(erg["kraterdurchmesser"], P().proj_durchmesser)
        self.assertGreaterEqual(erg["E_dissipiert"], 0.0)
        self._impulsbilanz(erg)

    def test_durchschuss(self):
        erg = bal.simuliere(mit_material(P(geschwindigkeit=2500.0, proj_laenge=0.15), proj="WHA"))
        self.assertEqual(erg["ergebnis"], "Durchschuss")
        self.assertAlmostEqual(erg["eindringtiefe"], 0.1, places=9)
        self.assertGreater(erg["v_rest"], 0.0)
        self._impulsbilanz(erg)

    def test_blei_spritzt_ab(self):
        erg = bal.simuliere(mit_material(P(geschwindigkeit=400.0), proj="PB"))
        self.assertEqual(erg["regime"], [bal.OBERFLAECHE])
        self.assertEqual(erg["eindringtiefe"], 0.0)
        self._impulsbilanz(erg)

    def test_starres_eindringen(self):
        erg = bal.simuliere(mit_material(P(geschwindigkeit=800.0), proj="WC", ziel="AL"))
        self.assertEqual(erg["regime"], [bal.STARR])
        self.assertEqual(erg["ergebnis"], "Steckschuss")
        self.assertAlmostEqual(erg["m_rest"], erg["masse"], places=9)
        self._impulsbilanz(erg)

    def test_elastischer_abpraller(self):
        prm = mit_material(P(geschwindigkeit=30.0, wuerfel_frei=False, stosszahl=0.5), proj="STAHL_H")
        erg = bal.simuliere(prm)
        self.assertEqual(erg["ergebnis"], "Abpraller")
        vx, vz = erg["d"][0] * erg["v_aufprall"], erg["d"][2] * erg["v_aufprall"]
        # Normalkomponente wird mit e umgekehrt, Tangentialkomponente bleibt
        self.assertAlmostEqual(erg["v_rest"], math.hypot(0.5 * vx, vz), delta=1e-9)

    def test_elastisch_impuls_frei_gelagert(self):
        prm = mit_material(P(geschwindigkeit=20.0, stosszahl=0.8), proj="STAHL_H")
        erg = bal.simuliere(prm)
        m, M, v = erg["masse"], erg["M_wuerfel"], erg["d"][0] * erg["v_aufprall"]
        v_p = (m - 0.8 * M) * v / (m + M)
        self.assertAlmostEqual(m * v, m * v_p + M * erg["v_wuerfel"][0], delta=1e-9)

    def test_hoehere_geschwindigkeit_tiefer(self):
        tiefen = [bal.simuliere(P(geschwindigkeit=v, fragmente=0))["eindringtiefe"]
                  for v in (1000.0, 1500.0, 2000.0)]
        self.assertTrue(tiefen[0] < tiefen[1] < tiefen[2])


if __name__ == "__main__":
    unittest.main()
