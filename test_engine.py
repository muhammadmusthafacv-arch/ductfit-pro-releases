import unittest
import math
from ashrae_engine import AshraeEngine

class TestAshraeEngine(unittest.TestCase):

    def test_air_properties_standard(self):
        props = AshraeEngine.get_air_properties(standard_air=True)
        self.assertAlmostEqual(props["density_ip"], 0.075, places=3)
        self.assertAlmostEqual(props["pressure_in_hg"], 29.921, places=3)

    def test_reynolds_standard(self):
        # ASHRAE Eq 21: Re = 8.50 * D * V
        re = AshraeEngine.calc_reynolds(12.0, 1910.0)
        self.assertAlmostEqual(re, 8.50 * 12.0 * 1910.0, places=1)

    def test_table_9_section_1(self):
        # Section 1: 1500 cfm, 12 in round duct -> V = 1910 fpm, Loss = 0.40 in. wg/100 ft
        res = AshraeEngine.solve_sizing("flow_diameter", 1500, 12)
        self.assertAlmostEqual(res["velocity_fpm"], 1910, delta=2.0)
        self.assertAlmostEqual(res["friction_rate_ip"], 0.40, delta=0.015)
        self.assertAlmostEqual(res["velocity_pressure_ip"], 0.23, delta=0.01)

    def test_table_9_section_2(self):
        # Section 2: 500 cfm, 8 in round duct -> V = 1432 fpm, Loss = 0.39 in. wg/100 ft
        res = AshraeEngine.solve_sizing("flow_diameter", 500, 8)
        self.assertAlmostEqual(res["velocity_fpm"], 1432, delta=2.0)
        self.assertAlmostEqual(res["friction_rate_ip"], 0.39, delta=0.015)

    def test_table_9_section_3(self):
        # Section 3: 2000 cfm, 12 in round duct -> V = 2546 fpm, Loss = 0.69 in. wg/100 ft
        res = AshraeEngine.solve_sizing("flow_diameter", 2000, 12)
        self.assertAlmostEqual(res["velocity_fpm"], 2546, delta=2.0)
        self.assertAlmostEqual(res["friction_rate_ip"], 0.69, delta=0.015)

    def test_table_9_section_5(self):
        # Section 5: 2000 cfm, 14 in round duct -> V = 1871 fpm, Loss = 0.32 in. wg/100 ft
        res = AshraeEngine.solve_sizing("flow_diameter", 2000, 14)
        self.assertAlmostEqual(res["velocity_fpm"], 1871, delta=2.0)
        self.assertAlmostEqual(res["friction_rate_ip"], 0.32, delta=0.015)

    def test_table_9_section_6(self):
        # Section 6: 4000 cfm, 17 in round duct -> V = 2538 fpm, Loss = 0.45 in. wg/100 ft
        res = AshraeEngine.solve_sizing("flow_diameter", 4000, 17)
        self.assertAlmostEqual(res["velocity_fpm"], 2538, delta=2.0)
        self.assertAlmostEqual(res["friction_rate_ip"], 0.45, delta=0.015)

    def test_table_9_rectangular_sections(self):
        # Section 7: 600 cfm, 10x10 in (De=10.9 in) -> Loss = 0.12 in/100ft
        de7 = AshraeEngine.rectangular_to_de(10, 10)
        self.assertAlmostEqual(de7, 10.93, delta=0.1)
        res7 = AshraeEngine.solve_sizing("flow_diameter", 600, de7)
        self.assertAlmostEqual(res7["friction_rate_ip"], 0.12, delta=0.015)

        # Section 9: 1200 cfm, 20x10 in (De=15.2 in) -> Loss = 0.08 in/100ft
        de9 = AshraeEngine.rectangular_to_de(20, 10)
        self.assertAlmostEqual(de9, 15.23, delta=0.1)
        res9 = AshraeEngine.solve_sizing("flow_diameter", 1200, de9)
        self.assertAlmostEqual(res9["friction_rate_ip"], 0.08, delta=0.015)

        # Section 10: 1200 cfm, 16x10 in (De=13.7 in) -> Loss = 0.13 in/100ft
        de10 = AshraeEngine.rectangular_to_de(16, 10)
        self.assertAlmostEqual(de10, 13.73, delta=0.1)
        res10 = AshraeEngine.solve_sizing("flow_diameter", 1200, de10)
        self.assertAlmostEqual(res10["friction_rate_ip"], 0.13, delta=0.015)

    def test_sizing_modes_consistency(self):
        # If Q=1500 and target_dp=0.404 -> D should be 12.0 in
        res1 = AshraeEngine.solve_sizing("flow_headloss", 1500, 0.404)
        self.assertAlmostEqual(res1["diameter_in"], 12.0, delta=0.05)

        # If Q=1500 and V=1910 -> D should be 12.0 in
        res2 = AshraeEngine.solve_sizing("flow_velocity", 1500, 1910)
        self.assertAlmostEqual(res2["diameter_in"], 12.0, delta=0.05)

    def test_flat_oval_table_3(self):
        # Table 3: a=10, A=19 -> De = 14.4 in
        de = AshraeEngine.flat_oval_to_de(10, 19)
        self.assertAlmostEqual(de, 14.4, delta=0.1)

        # Reverse solver
        A_sol = AshraeEngine.de_to_flat_oval(de, 10)
        self.assertAlmostEqual(A_sol, 19.0, delta=0.05)

    def test_flexible_duct(self):
        # D=10 in, L=4 ft, LFE=5 ft -> rc = 0.2
        pdcf, rc = AshraeEngine.flex_duct_compression_correction(10, 4, 5)
        self.assertAlmostEqual(rc, 0.2, places=2)
        expected = 1.0 + 58.0 * 0.2 * math.exp(-0.126 * 10)
        self.assertAlmostEqual(pdcf, expected, places=3)

    def test_colebrook_laminar(self):
        # Laminar flow: Re = 66.4 * Dh * V < 2300 -> f = 64 / Re
        c_data = AshraeEngine.calc_colebrook_f(50.0, 0.090, 0.5)
        self.assertEqual(c_data["regime"], "Laminar")
        self.assertAlmostEqual(c_data["f"], 64.0 / (66.4 * 50.0 * 0.5), places=5)

    def test_colebrook_turbulent_exact_residual(self):
        # Test across multiple diameters and velocities: check Colebrook Eq (19) residual is < 1e-12
        for Dh in [100.0, 200.0, 300.0, 400.0, 600.0, 1000.0]:
            for V in [2.0, 5.0, 10.0, 25.0]:
                c_data = AshraeEngine.calc_colebrook_f(Dh, 0.090, V)
                f = c_data["f"]
                Re = c_data["Re"]
                # Colebrook Eq. (19): 1/sqrt(f) = -2 * log10(e/(3.7*Dh) + 2.51/(Re*sqrt(f)))
                lhs = 1.0 / math.sqrt(f)
                arg = (0.090 / (3.7 * Dh)) + 2.51 / (Re * math.sqrt(f))
                rhs = -2.0 * math.log10(arg)
                self.assertAlmostEqual(lhs, rhs, delta=1e-10)

if __name__ == '__main__':
    unittest.main()
