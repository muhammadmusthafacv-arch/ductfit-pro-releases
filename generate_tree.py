import json

# Comprehensive ASHRAE Duct Fitting Catalog & Tree
# Mapped directly from ASHRAE Duct Fitting Database (v5.0 & v6.0) & 2009 ASHRAE Fundamentals Chapter 21

TREE_DATA = {
    "id": "root",
    "name": "ASHRAE Duct Fitting Database",
    "children": [
        {
            "id": "supply",
            "name": "Supply",
            "children": [
                {
                    "id": "supply_round",
                    "name": "Round",
                    "children": [
                        {
                            "id": "supply_round_plenums",
                            "name": "Plenums",
                            "items": [
                                {
                                    "code": "SD1-1",
                                    "name": "Bellmouth, Plenum to Round",
                                    "citation": "Idelchik 1986, Diagram 4-9",
                                    "category": "Plenums",
                                    "shape": "round",
                                    "type": "entry",
                                    "inputs": [
                                        {"id": "D", "label_si": "Duct Diameter (D, mm)", "label_ip": "Duct Diameter (D, in.)", "default_si": 300, "default_ip": 12, "step": 10},
                                        {"id": "r", "label_si": "Bellmouth Radius (r, mm)", "label_ip": "Bellmouth Radius (r, in.)", "default_si": 60, "default_ip": 2.5, "step": 5},
                                        {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 2000, "default_ip": 4238, "step": 50},
                                        {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                                    ],
                                    "outputs": ["V", "Pv", "Co", "dp"],
                                    "coeff_formula": "r/D >= 0.15 ? 0.03 : 0.03 + 0.47 * Math.pow(1 - (r/D)/0.15, 2)",
                                    "drawing": "plenum_round"
                                },
                                {
                                    "code": "SD1-2",
                                    "name": "Conical Bellmouth/Sudden Contraction",
                                    "citation": "Idelchik 1986, Diagram 4-10",
                                    "category": "Plenums",
                                    "shape": "round",
                                    "type": "entry",
                                    "inputs": [
                                        {"id": "D", "label_si": "Duct Diameter (D, mm)", "label_ip": "Duct Diameter (D, in.)", "default_si": 300, "default_ip": 12, "step": 10},
                                        {"id": "theta", "label_si": "Cone Angle (deg)", "label_ip": "Cone Angle (deg)", "default_si": 60, "default_ip": 60, "step": 5},
                                        {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 2000, "default_ip": 4238, "step": 50},
                                        {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                                    ],
                                    "outputs": ["V", "Pv", "Co", "dp"],
                                    "coeff_formula": "0.15",
                                    "drawing": "conical_plenum_round"
                                }
                            ]
                        },
                        {
                            "id": "supply_round_exits",
                            "name": "Exits",
                            "items": [
                                {
                                    "code": "SD2-1",
                                    "name": "Abrupt Exit",
                                    "citation": "Idelchik 1986, Diagram 11-1",
                                    "category": "Exits",
                                    "shape": "round",
                                    "type": "exit",
                                    "inputs": [
                                        {"id": "D", "label_si": "Diameter (D, mm)", "label_ip": "Diameter (D, in.)", "default_si": 300, "default_ip": 12, "step": 10},
                                        {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 2000, "default_ip": 4238, "step": 50},
                                        {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                                    ],
                                    "outputs": ["V", "Pv", "Co", "dp"],
                                    "coeff_formula": "1.00",
                                    "drawing": "exit_abrupt_round"
                                },
                                {
                                    "code": "SD2-2",
                                    "name": "Discharge from a Duct Flush with Wall",
                                    "citation": "Idelchik 1986, Diagram 11-2",
                                    "category": "Exits",
                                    "shape": "round",
                                    "type": "exit",
                                    "inputs": [
                                        {"id": "D", "label_si": "Diameter (D, mm)", "label_ip": "Diameter (D, in.)", "default_si": 300, "default_ip": 12, "step": 10},
                                        {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 2000, "default_ip": 4238, "step": 50},
                                        {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                                    ],
                                    "outputs": ["V", "Pv", "Co", "dp"],
                                    "coeff_formula": "1.00",
                                    "drawing": "exit_flush_round"
                                },
                                {
                                    "code": "SD2-3",
                                    "name": "Conical Diffuser, Free Discharge",
                                    "citation": "Idelchik 1986, Diagram 11-4",
                                    "category": "Exits",
                                    "shape": "round",
                                    "type": "exit",
                                    "inputs": [
                                        {"id": "D1", "label_si": "Inlet Diameter (D1, mm)", "label_ip": "Inlet Diameter (D1, in.)", "default_si": 300, "default_ip": 12, "step": 10},
                                        {"id": "Do", "label_si": "Outlet Diameter (Do, mm)", "label_ip": "Outlet Diameter (Do, in.)", "default_si": 450, "default_ip": 18, "step": 10},
                                        {"id": "L", "label_si": "Diffuser Length (L, mm)", "label_ip": "Diffuser Length (L, in.)", "default_si": 400, "default_ip": 16, "step": 10},
                                        {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 2000, "default_ip": 4238, "step": 50},
                                        {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                                    ],
                                    "outputs": ["V1", "Pv1", "Co", "dp"],
                                    "coeff_formula": "0.38",
                                    "drawing": "conical_diffuser_free"
                                },
                                {
                                    "code": "SD2-4",
                                    "name": "Conical Diffuser, with Wall",
                                    "citation": "Idelchik 1986, Diagram 11-5",
                                    "category": "Exits",
                                    "shape": "round",
                                    "type": "exit",
                                    "inputs": [
                                        {"id": "D1", "label_si": "Inlet Diameter (D1, mm)", "label_ip": "Inlet Diameter (D1, in.)", "default_si": 300, "default_ip": 12, "step": 10},
                                        {"id": "Do", "label_si": "Outlet Diameter (Do, mm)", "label_ip": "Outlet Diameter (Do, in.)", "default_si": 450, "default_ip": 18, "step": 10},
                                        {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 2000, "default_ip": 4238, "step": 50},
                                        {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                                    ],
                                    "outputs": ["V1", "Pv1", "Co", "dp"],
                                    "coeff_formula": "0.42",
                                    "drawing": "conical_diffuser_wall"
                                },
                                {
                                    "code": "SD2-5",
                                    "name": "Exhaust Hood",
                                    "citation": "Idelchik 1986, Diagram 11-7",
                                    "category": "Exits",
                                    "shape": "round",
                                    "type": "exit",
                                    "inputs": [
                                        {"id": "D", "label_si": "Diameter (D, mm)", "label_ip": "Diameter (D, in.)", "default_si": 300, "default_ip": 12, "step": 10},
                                        {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 2000, "default_ip": 4238, "step": 50},
                                        {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                                    ],
                                    "outputs": ["V", "Pv", "Co", "dp"],
                                    "coeff_formula": "0.95",
                                    "drawing": "exhaust_hood_round"
                                },
                                {
                                    "code": "SD2-6",
                                    "name": "Stackhead (Dexit/D=1)",
                                    "citation": "Idelchik 1986, Diagram 11-8",
                                    "category": "Exits",
                                    "shape": "round",
                                    "type": "exit",
                                    "inputs": [
                                        {"id": "D", "label_si": "Diameter (D, mm)", "label_ip": "Diameter (D, in.)", "default_si": 300, "default_ip": 12, "step": 10},
                                        {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 2000, "default_ip": 4238, "step": 50},
                                        {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                                    ],
                                    "outputs": ["V", "Pv", "Co", "dp"],
                                    "coeff_formula": "0.78",
                                    "drawing": "stackhead_round"
                                },
                                {
                                    "code": "SD2-7",
                                    "name": "Stackhead (Dexit/D<1)",
                                    "citation": "Idelchik 1986, Diagram 11-9",
                                    "category": "Exits",
                                    "shape": "round",
                                    "type": "exit",
                                    "inputs": [
                                        {"id": "D", "label_si": "Diameter (D, mm)", "label_ip": "Diameter (D, in.)", "default_si": 300, "default_ip": 12, "step": 10},
                                        {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 2000, "default_ip": 4238, "step": 50},
                                        {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                                    ],
                                    "outputs": ["V", "Pv", "Co", "dp"],
                                    "coeff_formula": "1.25",
                                    "drawing": "stackhead_round"
                                }
                            ]
                        },
                        {
                            "id": "supply_round_transitions",
                            "name": "Transitions",
                            "items": [
                                {
                                    "code": "SD4-1",
                                    "name": "Round to Round",
                                    "citation": "Idelchik 1986, Diagrams 5-2 & 5-22",
                                    "category": "Transitions",
                                    "shape": "round",
                                    "type": "transition",
                                    "inputs": [
                                        {"id": "D1", "label_si": "Inlet Diameter (D1, mm)", "label_ip": "Inlet Diameter (D1, in.)", "default_si": 400, "default_ip": 16, "step": 10},
                                        {"id": "Do", "label_si": "Outlet Diameter (Do, mm)", "label_ip": "Outlet Diameter (Do, in.)", "default_si": 300, "default_ip": 12, "step": 10},
                                        {"id": "theta", "label_si": "Cone Angle (deg)", "label_ip": "Cone Angle (deg)", "default_si": 30, "default_ip": 30, "step": 5},
                                        {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 2000, "default_ip": 4238, "step": 50},
                                        {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                                    ],
                                    "outputs": ["Vo", "Pvo", "Co", "dp"],
                                    "coeff_formula": "0.05",
                                    "drawing": "trans_round_round"
                                },
                                {
                                    "code": "SD4-2",
                                    "name": "Rectangular to Round",
                                    "citation": "Idelchik 1986, Diagram 5-27",
                                    "category": "Transitions",
                                    "shape": "mixed",
                                    "type": "transition",
                                    "inputs": [
                                        {"id": "H1", "label_si": "Inlet Height (H1, mm)", "label_ip": "Inlet Height (H1, in.)", "default_si": 300, "default_ip": 12, "step": 10},
                                        {"id": "W1", "label_si": "Inlet Width (W1, mm)", "label_ip": "Inlet Width (W1, in.)", "default_si": 400, "default_ip": 16, "step": 10},
                                        {"id": "Do", "label_si": "Outlet Diameter (Do, mm)", "label_ip": "Outlet Diameter (Do, in.)", "default_si": 350, "default_ip": 14, "step": 10},
                                        {"id": "L", "label_si": "Length (L, mm)", "label_ip": "Length (L, in.)", "default_si": 300, "default_ip": 12, "step": 10},
                                        {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 2000, "default_ip": 4238, "step": 50},
                                        {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                                    ],
                                    "outputs": ["Vo", "Pvo", "Co", "dp"],
                                    "coeff_formula": "0.14",
                                    "drawing": "trans_rect_round"
                                }
                            ]
                        },
                        {
                            "id": "supply_round_junctions",
                            "name": "Junctions, Diverging",
                            "children": [
                                {
                                    "id": "sd5_cross",
                                    "name": "Cross",
                                    "items": [
                                        {"code": "SD5-20", "name": "90 degree, Capped", "citation": "Sepsy 1969", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch Diameter (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Common Flow (Qc, L/s)", "default_si": 2000}, {"id": "Qb", "label_si": "Branch Flow (Qb, L/s)", "default_si": 600}], "coeff_formula": "0.85", "drawing": "junction_cross"},
                                        {"code": "SD5-24", "name": "90 degree", "citation": "UMC 1990, Fig. 33", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch Diameter (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Common Flow (Qc, L/s)", "default_si": 2000}, {"id": "Qb", "label_si": "Branch Flow (Qb, L/s)", "default_si": 600}], "coeff_formula": "0.74", "drawing": "junction_cross"},
                                        {"code": "SD5-25", "name": "Conical Branches, Tapered into Body", "citation": "UMC 1990, Fig. 33", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch Diameter (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Common Flow (Qc, L/s)", "default_si": 2000}, {"id": "Qb", "label_si": "Branch Flow (Qb, L/s)", "default_si": 600}], "coeff_formula": "0.48", "drawing": "junction_cross"},
                                        {"code": "SD5-26", "name": "45 degree Entry Branches", "citation": "UMC 1990, Fig. 33", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch Diameter (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Common Flow (Qc, L/s)", "default_si": 2000}, {"id": "Qb", "label_si": "Branch Flow (Qb, L/s)", "default_si": 600}], "coeff_formula": "0.52", "drawing": "junction_cross"}
                                    ]
                                },
                                {
                                    "id": "sd5_tee",
                                    "name": "Tee",
                                    "children": [
                                        {
                                            "id": "sd5_tee_bullhead",
                                            "name": "Bullhead",
                                            "items": [
                                                {"code": "SD5-18", "name": "Without Vanes", "citation": "Sepsy 1969", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Inlet Diameter (Dc, mm)", "default_si": 300}, {"id": "Db1", "label_si": "Branch 1 (Db1, mm)", "default_si": 220}, {"id": "Db2", "label_si": "Branch 2 (Db2, mm)", "default_si": 220}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "1.30", "drawing": "tee_bullhead_round"},
                                                {"code": "SD5-19", "name": "With Vanes", "citation": "Sepsy 1969", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Inlet Diameter (Dc, mm)", "default_si": 300}, {"id": "Db1", "label_si": "Branch 1 (Db1, mm)", "default_si": 220}, {"id": "Db2", "label_si": "Branch 2 (Db2, mm)", "default_si": 220}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.45", "drawing": "tee_bullhead_round"}
                                            ]
                                        },
                                        {
                                            "id": "sd5_tee_conical",
                                            "name": "Conical Branch",
                                            "items": [
                                                {"code": "SD5-10", "name": "Conical Branch Tapered into Body", "citation": "UMC 1986, Report SRF386", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch Diameter (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}, {"id": "Qb", "label_si": "Branch Flow (Qb, L/s)", "default_si": 600}], "coeff_formula": "0.38", "drawing": "tee_round"},
                                                {"code": "SD5-9", "name": "Conical Branch", "citation": "Jones 1969, Fig. 12", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch Diameter (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}, {"id": "Qb", "label_si": "Branch Flow (Qb, L/s)", "default_si": 600}], "coeff_formula": "0.42", "drawing": "tee_round"},
                                                {"code": "SD5-14", "name": "With 45 deg. Elbow, Br 90 deg", "citation": "Jones 1969", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch Diameter (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}, {"id": "Qb", "label_si": "Branch Flow (Qb, L/s)", "default_si": 600}], "coeff_formula": "0.58", "drawing": "tee_round"},
                                                {"code": "SD5-17", "name": "With 60 deg. Elbow, Br 45 deg", "citation": "Jones 1969", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch Diameter (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}, {"id": "Qb", "label_si": "Branch Flow (Qb, L/s)", "default_si": 600}], "coeff_formula": "0.55", "drawing": "tee_round"}
                                            ]
                                        },
                                        {
                                            "id": "sd5_tee_nonconical",
                                            "name": "Non-Conical Branch",
                                            "items": [
                                                {"code": "SD5-12", "name": "45 deg. Entry Branch", "citation": "UMC 1986, Report SRF386", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch Diameter (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}, {"id": "Qb", "label_si": "Branch Flow (Qb, L/s)", "default_si": 600}], "coeff_formula": "0.48", "drawing": "tee_round"},
                                                {"code": "SD5-13", "name": "With 45 deg. Elbows, Br 90 deg", "citation": "Jones 1969", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch Diameter (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.62", "drawing": "tee_round"},
                                                {"code": "SD5-15", "name": "With 90 deg. Elbow, Br 90 deg", "citation": "Jones 1969", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch Diameter (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.78", "drawing": "tee_round"},
                                                {"code": "SD5-16", "name": "With 60 deg. Elbow, Br 45 deg", "citation": "Jones 1969", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch Diameter (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.66", "drawing": "tee_round"},
                                                {"code": "SD5-34", "name": "90 degree", "citation": "Sepsy 1973", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch Diameter (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}, {"id": "Qb", "label_si": "Branch Flow (Qb, L/s)", "default_si": 600}], "coeff_formula": "0.85", "drawing": "tee_round"}
                                            ]
                                        }
                                    ]
                                },
                                {
                                    "id": "sd5_wye",
                                    "name": "Wye",
                                    "children": [
                                        {
                                            "id": "sd5_wye_conical",
                                            "name": "Conical Branch",
                                            "items": [
                                                {"code": "SD5-27", "name": "Conical Branch Tapered into Body", "citation": "UMC 1986", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.32", "drawing": "wye_round"},
                                                {"code": "SD5-3", "name": "90 deg. Straight Body Branch", "citation": "UMC 1986", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.45", "drawing": "wye_round"},
                                                {"code": "SD5-5", "name": "Con Br with 60 deg. Elbow, Br 90 deg", "citation": "Jones 1969", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.52", "drawing": "wye_round"},
                                                {"code": "SD5-8", "name": "45 deg. Con Br with 30 deg. Elbow", "citation": "Jones 1969", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.42", "drawing": "wye_round"}
                                            ]
                                        },
                                        {
                                            "id": "sd5_wye_nonconical",
                                            "name": "Non-Conical Branch",
                                            "items": [
                                                {"code": "SD5-1", "name": "45 degree", "citation": "Sepsy 1973", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.40", "drawing": "wye_round"},
                                                {"code": "SD5-2", "name": "45 deg. Straight Body Branch", "citation": "Jones 1963", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.44", "drawing": "wye_round"},
                                                {"code": "SD5-4", "name": "45 deg. with 45 deg. Elbow, Br 90 deg", "citation": "UMC 1986", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.65", "drawing": "wye_round"},
                                                {"code": "SD5-6", "name": "45 deg. with 60 deg. Elbow, Br 90 deg", "citation": "Jones 1963", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.58", "drawing": "wye_round"},
                                                {"code": "SD5-7", "name": "45 deg. with 30 deg. Elbow, Br 45 deg", "citation": "Jones 1963", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.48", "drawing": "wye_round"},
                                                {"code": "SD5-22", "name": "Symmetrical Wye, 90 deg. with 45 deg. Elbows", "citation": "Sepsy 1969", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Inlet Diameter (Dc, mm)", "default_si": 300}, {"id": "Db1", "label_si": "Branch 1 (Db1, mm)", "default_si": 220}, {"id": "Db2", "label_si": "Branch 2 (Db2, mm)", "default_si": 220}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.72", "drawing": "wye_round"}
                                            ]
                                        }
                                    ]
                                },
                                {"code": "SD5-21", "name": "Heel-Tapped Elbow", "citation": "UMC 1990", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Diameter (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Tap Diameter (Db, mm)", "default_si": 150}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.35", "drawing": "elbow_round"},
                                {"code": "SD5-23", "name": "Double Wye", "citation": "UMC 1990, Fig. 33", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.50", "drawing": "wye_round"}
                            ]
                        },
                        {
                            "id": "supply_round_fans",
                            "name": "Fan & System Interactions",
                            "items": [
                                {"code": "SD7-1", "name": "Centrifugal Fan Outlet, SWSI, with Elbow", "citation": "AMCA 2007", "shape": "round", "inputs": [{"id": "D", "label_si": "Diameter (D, mm)", "default_si": 400}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2500}], "coeff_formula": "1.20", "drawing": "fan_round"},
                                {"code": "SD7-2", "name": "Centrifugal Fan Outlet, SWSI, Discharge", "citation": "AMCA 2007", "shape": "round", "inputs": [{"id": "D", "label_si": "Diameter (D, mm)", "default_si": 400}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2500}], "coeff_formula": "0.85", "drawing": "fan_round"},
                                {"code": "SD7-3", "name": "Axial Fan Outlet, Discharge", "citation": "AMCA 2007", "shape": "round", "inputs": [{"id": "D", "label_si": "Diameter (D, mm)", "default_si": 400}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2500}], "coeff_formula": "0.60", "drawing": "fan_round"}
                            ]
                        }
                    ]
                },
                {
                    "id": "supply_rect",
                    "name": "Rectangular",
                    "children": [
                        {
                            "id": "supply_rect_plenums",
                            "name": "Plenums",
                            "items": [
                                {"code": "SR1-1", "name": "Bellmouth, Plenum to Rectangular", "citation": "Idelchik 1986", "shape": "rect", "inputs": [{"id": "H", "label_si": "Height (H, mm)", "default_si": 300}, {"id": "W", "label_si": "Width (W, mm)", "default_si": 400}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.05", "drawing": "plenum_rect"}
                            ]
                        },
                        {
                            "id": "supply_rect_exits",
                            "name": "Exits",
                            "items": [
                                {"code": "SR2-1", "name": "Abrupt Exit, Rectangular", "citation": "Idelchik 1986", "shape": "rect", "inputs": [{"id": "H", "label_si": "Height (H, mm)", "default_si": 300}, {"id": "W", "label_si": "Width (W, mm)", "default_si": 400}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "1.00", "drawing": "exit_abrupt_rect"},
                                {"code": "SR2-3", "name": "Plain Diffuser (Two Sides Parallel), Free Discharge", "citation": "Idelchik 1986", "shape": "rect", "inputs": [{"id": "H", "label_si": "Height (H, mm)", "default_si": 300}, {"id": "W1", "label_si": "Inlet Width (W1, mm)", "default_si": 300}, {"id": "Wo", "label_si": "Outlet Width (Wo, mm)", "default_si": 600}, {"id": "L", "label_si": "Length (L, mm)", "default_si": 500}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.35", "drawing": "diffuser_rect"}
                            ]
                        },
                        {
                            "id": "supply_rect_transitions",
                            "name": "Transitions",
                            "items": [
                                {"code": "SR4-1", "name": "Rectangular, Two Sides Parallel", "citation": "Idelchik 1986", "shape": "rect", "inputs": [{"id": "H", "label_si": "Height (H, mm)", "default_si": 300}, {"id": "W1", "label_si": "Inlet Width (W1, mm)", "default_si": 500}, {"id": "W2", "label_si": "Outlet Width (W2, mm)", "default_si": 300}, {"id": "L", "label_si": "Length (L, mm)", "default_si": 400}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.08", "drawing": "trans_rect"},
                                {"code": "SR4-3", "name": "Round to Rectangular, Supply Air Systems", "citation": "Idelchik 1986", "shape": "mixed", "inputs": [{"id": "D1", "label_si": "Inlet Diameter (D1, mm)", "default_si": 350}, {"id": "H2", "label_si": "Outlet Height (H2, mm)", "default_si": 300}, {"id": "W2", "label_si": "Outlet Width (W2, mm)", "default_si": 400}, {"id": "L", "label_si": "Length (L, mm)", "default_si": 400}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.15", "drawing": "trans_round_rect"}
                            ]
                        },
                        {
                            "id": "supply_rect_junctions",
                            "name": "Junctions, Diverging",
                            "items": [
                                {"code": "SR5-1", "name": "Wye, 45 Degree", "citation": "Idelchik 1986", "shape": "rect", "inputs": [{"id": "Hc", "label_si": "Height (Hc, mm)", "default_si": 300}, {"id": "Wc", "label_si": "Main Width (Wc, mm)", "default_si": 500}, {"id": "Wb", "label_si": "Branch Width (Wb, mm)", "default_si": 300}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.40", "drawing": "wye_rect"},
                                {"code": "SR5-13", "name": "Tee, 45 Degree Entry Branch, Diverging", "citation": "Idelchik 1986", "shape": "rect", "inputs": [{"id": "Hc", "label_si": "Height (Hc, mm)", "default_si": 300}, {"id": "Wc", "label_si": "Main Width (Wc, mm)", "default_si": 500}, {"id": "Wb", "label_si": "Branch Width (Wb, mm)", "default_si": 300}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.45", "drawing": "tee_rect"}
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "common",
            "name": "Common (Supply & Return)",
            "children": [
                {
                    "id": "common_straight",
                    "name": "Straight Ducts",
                    "items": [
                        {
                            "code": "CR11-1",
                            "name": "Straight Duct, Rectangular (Huebscher 1948)",
                            "citation": "Huebscher 1948",
                            "category": "Straight Ducts",
                            "shape": "rect",
                            "type": "straight",
                            "inputs": [
                                {"id": "H", "label_si": "Height (H, mm)", "label_ip": "Height (H, in.)", "default_si": 300, "default_ip": 12, "step": 1},
                                {"id": "W", "label_si": "Width (W, mm)", "label_ip": "Width (W, in.)", "default_si": 300, "default_ip": 12, "step": 1},
                                {"id": "e", "label_si": "Absolute Roughness (e, mm)", "label_ip": "Absolute Roughness (e, ft)", "default_si": 0.090, "default_ip": 0.0003, "step": 0.005},
                                {"id": "L", "label_si": "Length (L, m)", "label_ip": "Length (L, ft)", "default_si": 3, "default_ip": 10, "step": 0.5},
                                {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 2000, "default_ip": 4238, "step": 50},
                                {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                            ],
                            "outputs": ["V", "Pv", "f", "dp"],
                            "drawing": "straight_rect"
                        },
                        {
                            "code": "CD11-1",
                            "name": "Straight Duct, Round (Colebrook 1939)",
                            "citation": "Colebrook 1939",
                            "category": "Straight Ducts",
                            "shape": "round",
                            "type": "straight",
                            "inputs": [
                                {"id": "D", "label_si": "Diameter (D, mm)", "label_ip": "Diameter (D, in.)", "default_si": 300, "default_ip": 12, "step": 5},
                                {"id": "e", "label_si": "Absolute Roughness (e, mm)", "label_ip": "Absolute Roughness (e, ft)", "default_si": 0.090, "default_ip": 0.0003, "step": 0.005},
                                {"id": "L", "label_si": "Length (L, m)", "label_ip": "Length (L, ft)", "default_si": 3, "default_ip": 10, "step": 0.5},
                                {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 2000, "default_ip": 4238, "step": 50},
                                {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                            ],
                            "outputs": ["V", "Pv", "f", "dp"],
                            "drawing": "straight_round"
                        },
                        {
                            "code": "CD11-2",
                            "name": "Straight Duct, Flexible (Abushakra 2004)",
                            "citation": "Abushakra 2004",
                            "category": "Straight Ducts",
                            "shape": "round",
                            "type": "straight",
                            "inputs": [
                                {"id": "D", "label_si": "Diameter (D, mm)", "label_ip": "Diameter (D, in.)", "default_si": 250, "default_ip": 10, "step": 5},
                                {"id": "L", "label_si": "Installed Length (L, m)", "label_ip": "Installed Length (L, ft)", "default_si": 3, "default_ip": 10, "step": 0.5},
                                {"id": "LFE", "label_si": "Fully Extended (LFE, m)", "label_ip": "Fully Extended (LFE, ft)", "default_si": 3.75, "default_ip": 12.5, "step": 0.5},
                                {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 1000, "default_ip": 2119, "step": 50},
                                {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                            ],
                            "outputs": ["V", "Pv", "f", "dp"],
                            "drawing": "straight_round"
                        },
                        {
                            "code": "CF11-1",
                            "name": "Straight Duct, Flat Oval (Heyt and Diaz 1975)",
                            "citation": "Heyt and Diaz 1975",
                            "category": "Straight Ducts",
                            "shape": "oval",
                            "type": "straight",
                            "inputs": [
                                {"id": "a", "label_si": "Minor Axis (a, mm)", "label_ip": "Minor Axis (a, in.)", "default_si": 200, "default_ip": 8, "step": 10},
                                {"id": "A", "label_si": "Major Axis (A, mm)", "label_ip": "Major Axis (A, in.)", "default_si": 400, "default_ip": 16, "step": 10},
                                {"id": "e", "label_si": "Absolute Roughness (e, mm)", "label_ip": "Absolute Roughness (e, ft)", "default_si": 0.090, "default_ip": 0.0003, "step": 0.005},
                                {"id": "L", "label_si": "Length (L, m)", "label_ip": "Length (L, ft)", "default_si": 3, "default_ip": 10, "step": 0.5},
                                {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 2000, "default_ip": 4238, "step": 50},
                                {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                            ],
                            "outputs": ["V", "Pv", "f", "dp"],
                            "drawing": "straight_oval"
                        }
                    ]
                },
                {
                    "id": "common_round_elbows",
                    "name": "Round Elbows",
                    "items": [
                        {"code": "CD3-1", "name": "Die Stamped, 90 Degree, r/D = 1.5", "citation": "UMC 1985", "shape": "round", "inputs": [{"id": "D", "label_si": "Diameter (D, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.15", "drawing": "elbow_round"},
                        {"code": "CD3-2", "name": "5 Gore, 90 Degree, r/D = 1.0", "citation": "UMC 1985", "shape": "round", "inputs": [{"id": "D", "label_si": "Diameter (D, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.28", "drawing": "elbow_round"},
                        {"code": "CD3-3", "name": "Die Stamped, 45 Degree, r/D = 1.5", "citation": "UMC 1985", "shape": "round", "inputs": [{"id": "D", "label_si": "Diameter (D, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.10", "drawing": "elbow_round"},
                        {"code": "CD3-7", "name": "Pleated, 45 Degree, r/D = 1.5", "citation": "UMC 1989", "shape": "round", "inputs": [{"id": "D", "label_si": "Diameter (D, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.21", "drawing": "elbow_round"},
                        {"code": "CD3-9", "name": "5 Gore, 90 Degree, r/D = 1.5", "citation": "UMC 1985", "shape": "round", "inputs": [{"id": "D", "label_si": "Diameter (D, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.17", "drawing": "elbow_round"},
                        {"code": "CD3-15", "name": "Mitered, 90 Degree (No Vanes)", "citation": "UMC 1985", "shape": "round", "inputs": [{"id": "D", "label_si": "Diameter (D, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "1.20", "drawing": "elbow_round"},
                        {"code": "CD3-17", "name": "Mitered, 45 Degree", "citation": "UMC 1985", "shape": "round", "inputs": [{"id": "D", "label_si": "Diameter (D, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.34", "drawing": "elbow_round"},
                        {"code": "CD3-20", "name": "Mitered with Vanes, 90 Degree", "citation": "UMC 1985", "shape": "round", "inputs": [{"id": "D", "label_si": "Diameter (D, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.33", "drawing": "elbow_round"}
                    ]
                },
                {
                    "id": "common_rect_elbows",
                    "name": "Rectangular Elbows",
                    "items": [
                        {"code": "CR3-1", "name": "Smooth Radius without Vanes (r/W = 1.5)", "citation": "Idelchik 1986", "shape": "rect", "inputs": [{"id": "H", "label_si": "Height (H, mm)", "default_si": 300}, {"id": "W", "label_si": "Width (W, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.14", "drawing": "elbow_rect"},
                        {"code": "CR3-3", "name": "Smooth Radius with 1 Splitter Vane", "citation": "Locklin 1950", "shape": "rect", "inputs": [{"id": "H", "label_si": "Height (H, mm)", "default_si": 300}, {"id": "W", "label_si": "Width (W, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.12", "drawing": "elbow_rect"},
                        {"code": "CR3-6", "name": "Mitered without Vanes", "citation": "Idelchik 1986", "shape": "rect", "inputs": [{"id": "H", "label_si": "Height (H, mm)", "default_si": 300}, {"id": "W", "label_si": "Width (W, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "1.15", "drawing": "elbow_rect"},
                        {"code": "CR3-12", "name": "Mitered, 90 Degree, Single-Thickness Vanes", "citation": "Brooks 1993", "shape": "rect", "inputs": [{"id": "H", "label_si": "Height (H, mm)", "default_si": 300}, {"id": "W", "label_si": "Width (W, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.28", "drawing": "elbow_rect"},
                        {"code": "CR3-15", "name": "Mitered, 90 Degree, Double-Thickness Vanes", "citation": "Rozell 1974", "shape": "rect", "inputs": [{"id": "H", "label_si": "Height (H, mm)", "default_si": 300}, {"id": "W", "label_si": "Width (W, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.24", "drawing": "elbow_rect"}
                    ]
                },
                {
                    "id": "common_dampers",
                    "name": "Dampers",
                    "items": [
                        {"code": "CD9-1", "name": "Butterfly Damper, Round (Open)", "citation": "ASHRAE 2009", "shape": "round", "inputs": [{"id": "D", "label_si": "Diameter (D, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.20", "drawing": "damper_round"},
                        {"code": "CR9-1", "name": "Opposed Blades VCD (Wide Open)", "citation": "ASHRAE 2009", "shape": "rect", "inputs": [{"id": "H", "label_si": "Height (H, mm)", "default_si": 300}, {"id": "W", "label_si": "Width (W, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.18", "drawing": "damper_rect"},
                        {"code": "CR9-3", "name": "Parallel 3V Blades Open", "citation": "ASHRAE 2009", "shape": "rect", "inputs": [{"id": "H", "label_si": "Height (H, mm)", "default_si": 300}, {"id": "W", "label_si": "Width (W, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.52", "drawing": "damper_rect"},
                        {"code": "CR9-4", "name": "Fire Damper, Curtain Type B", "citation": "ASHRAE 2009", "shape": "rect", "inputs": [{"id": "H", "label_si": "Height (H, mm)", "default_si": 300}, {"id": "W", "label_si": "Width (W, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.18", "drawing": "damper_rect"}
                    ]
                }
            ]
        },
        {
            "id": "exhaust",
            "name": "Exhaust / Return",
            "children": [
                {
                    "id": "exhaust_round",
                    "name": "Round",
                    "children": [
                        {
                            "id": "ed_entries",
                            "name": "Entries",
                            "items": [
                                {"code": "ED1-1", "name": "Duct Mounted in Wall (Flush Entry)", "citation": "Idelchik 1986", "shape": "round", "inputs": [{"id": "D", "label_si": "Diameter (D, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.50", "drawing": "entry_flush_round"},
                                {"code": "ED1-3", "name": "Bellmouth (Smooth Radius)", "citation": "Idelchik 1986", "shape": "round", "inputs": [{"id": "D", "label_si": "Diameter (D, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.03", "drawing": "entry_bellmouth_round"},
                                {"code": "ED1-7", "name": "Flanged Duct Inlet", "citation": "Idelchik 1986", "shape": "round", "inputs": [{"id": "D", "label_si": "Diameter (D, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.25", "drawing": "entry_flanged_round"}
                            ]
                        },
                        {
                            "id": "ed_junctions",
                            "name": "Junctions, Converging",
                            "items": [
                                {"code": "ED5-1", "name": "Wye, 30 Degree, Converging", "citation": "Sepsy 1973", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.11", "drawing": "wye_round"},
                                {"code": "ED5-2", "name": "Wye, 45 Degree, Converging", "citation": "Sepsy 1973", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.40", "drawing": "wye_round"},
                                {"code": "ED5-3", "name": "Tee, Converging", "citation": "Sepsy 1973", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Main (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "0.18", "drawing": "tee_round"},
                                {"code": "ED5-4", "name": "Bullhead Tee without Vanes", "citation": "UMC 1985", "shape": "round", "inputs": [{"id": "Dc", "label_si": "Inlet (Dc, mm)", "default_si": 300}, {"id": "Db", "label_si": "Branch (Db, mm)", "default_si": 200}, {"id": "Qc", "label_si": "Flow (Qc, L/s)", "default_si": 2000}], "coeff_formula": "1.10", "drawing": "tee_bullhead_round"}
                            ]
                        }
                    ]
                },
                {
                    "id": "exhaust_rect",
                    "name": "Rectangular",
                    "children": [
                        {
                            "id": "er_transitions",
                            "name": "Transitions",
                            "items": [
                                {"code": "ER4-1", "name": "Rectangular, Two Sides Parallel, Symmetrical", "citation": "Idelchik 1986", "shape": "rect", "inputs": [{"id": "H", "label_si": "Height (H, mm)", "default_si": 300}, {"id": "W1", "label_si": "Width 1 (W1, mm)", "default_si": 500}, {"id": "W2", "label_si": "Width 2 (W2, mm)", "default_si": 300}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.10", "drawing": "trans_rect"},
                                {"code": "ER4-3", "name": "Rectangular to Round, Exhaust Systems", "citation": "Idelchik 1986", "shape": "mixed", "inputs": [{"id": "H1", "label_si": "Inlet Height (H1, mm)", "default_si": 300}, {"id": "W1", "label_si": "Inlet Width (W1, mm)", "default_si": 400}, {"id": "Do", "label_si": "Outlet Diam (Do, mm)", "default_si": 350}, {"id": "Q", "label_si": "Flow (Q, L/s)", "default_si": 2000}], "coeff_formula": "0.72", "drawing": "trans_rect_round"}
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "sizing_tools",
            "name": "Automated Duct Sizing Tools",
            "items": [
                {
                    "code": "SIZE-RECT",
                    "name": "Auto Rectangular Duct Sizer (Huebscher 1948)",
                    "citation": "ASHRAE Fundamentals Ch. 21",
                    "category": "Duct Sizing",
                    "shape": "rect",
                    "type": "sizer_rect",
                    "inputs": [
                        {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 2000, "default_ip": 4238, "step": 50},
                        {"id": "target_dp", "label_si": "Target Friction Rate (Pa/m)", "label_ip": "Target Friction (in/100ft)", "default_si": 1.0, "default_ip": 0.10, "step": 0.1},
                        {"id": "H", "label_si": "Fixed Height (H, mm)", "label_ip": "Fixed Height (H, in.)", "default_si": 300, "default_ip": 12, "step": 10},
                        {"id": "L", "label_si": "Duct Length (L, m)", "label_ip": "Duct Length (L, ft)", "default_si": 3, "default_ip": 10, "step": 0.5},
                        {"id": "e", "label_si": "Absolute Roughness (e, mm)", "label_ip": "Absolute Roughness (e, ft)", "default_si": 0.090, "default_ip": 0.0003, "step": 0.005},
                        {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                    ],
                    "outputs": ["W_sized", "V", "Pv", "f", "dp", "De", "AR"],
                    "drawing": "straight_rect"
                },
                {
                    "code": "SIZE-ROUND",
                    "name": "Auto Round Duct Sizer (Colebrook 1939)",
                    "citation": "ASHRAE Fundamentals Ch. 21",
                    "category": "Duct Sizing",
                    "shape": "round",
                    "type": "sizer_round",
                    "inputs": [
                        {"id": "Q", "label_si": "Flow Rate (Q, L/s)", "label_ip": "Flow Rate (Q, cfm)", "default_si": 2000, "default_ip": 4238, "step": 50},
                        {"id": "target_dp", "label_si": "Target Friction Rate (Pa/m)", "label_ip": "Target Friction (in/100ft)", "default_si": 1.0, "default_ip": 0.10, "step": 0.1},
                        {"id": "L", "label_si": "Duct Length (L, m)", "label_ip": "Duct Length (L, ft)", "default_si": 3, "default_ip": 10, "step": 0.5},
                        {"id": "e", "label_si": "Absolute Roughness (e, mm)", "label_ip": "Absolute Roughness (e, ft)", "default_si": 0.090, "default_ip": 0.0003, "step": 0.005},
                        {"id": "rho", "label_si": "Density (kg/m^3)", "label_ip": "Density (lbm/ft^3)", "default_si": 1.204, "default_ip": 0.075, "step": 0.001}
                    ],
                    "outputs": ["D_sized", "V", "Pv", "f", "dp"],
                    "drawing": "straight_round"
                }
            ]
        }
    ]
}

with open("fittings_tree.json", "w", encoding="utf-8") as f:
    json.dump(TREE_DATA, f, indent=2)

print("Saved fittings_tree.json successfully!")
