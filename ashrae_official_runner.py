import os
import re
import json
import math
import numpy as np

class AshraeTableParser:
    @staticmethod
    def _is_number(s):
        try:
            float(s)
            return True
        except (ValueError, TypeError):
            return False

    @staticmethod
    def _is_table_token(tok):
        clean = tok.rstrip('.')
        return bool(re.match(r'^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?(?:\([-+]?\d*\.?\d+\))?$', clean))

    @staticmethod
    def _is_table_num_row(line):
        tokens = line.strip().split()
        if not tokens:
            return False
        pure_nums = sum(1 for t in tokens if AshraeTableParser._is_table_token(t))
        return pure_nums >= 2 and (pure_nums / len(tokens)) >= 0.5

    @staticmethod
    def parse_file(filepath):
        with open(filepath, 'r', encoding='latin1') as f:
            lines = [line.rstrip() for line in f]
        
        raw_blocks = []
        cur_block = []
        for line in lines:
            if line.startswith('====='):
                if cur_block:
                    raw_blocks.append(cur_block)
                    cur_block = []
            elif line.startswith("'") or not line.strip():
                continue
            elif '#' in line and not any(c.isdigit() for c in line):
                continue
            else:
                cur_block.append(line)
        if cur_block:
            raw_blocks.append(cur_block)
            
        parsed_tables = {}
        for block_idx, block in enumerate(raw_blocks, start=1):
            parsed = AshraeTableParser._parse_block(block)
            if parsed:
                parsed_tables[block_idx] = parsed
        return parsed_tables

    @staticmethod
    def _parse_block(lines):
        data_lines = []
        title = ""
        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue
            if re.search(r'^[A-Z]{2}\d+-\d+', line_str) or 'Angle Factor' in line_str:
                title = line_str
            else:
                data_lines.append(line_str)
                
        if not data_lines:
            return None
            
        # Check if this is a 1D table (no arrow '->', and exactly 2 numeric data lines)
        has_arrow = any('->' in l for l in data_lines)
        if not has_arrow:
            numeric_lines = [l for l in data_lines if AshraeTableParser._is_table_num_row(l)]
            if len(numeric_lines) == 2:
                return AshraeTableParser._parse_1d(numeric_lines, title)
            
        arrow_line_idx = -1
        for idx, line in enumerate(data_lines):
            if '->' in line:
                arrow_line_idx = idx
                break
                
        if arrow_line_idx != -1:
            arrow_line = data_lines[arrow_line_idx]
            x_parts = arrow_line.split('->')
            x_var = x_parts[0].strip()
            x_vals = [float(x) for x in re.findall(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?', x_parts[1])]
            body_lines = data_lines[arrow_line_idx + 1:]
            
            # Filter out non-numeric comment/header lines before data
            while body_lines and not any(c.isdigit() for c in body_lines[0]) and len(body_lines[0].strip().split()) > 2:
                body_lines = body_lines[1:]
                
            if not body_lines:
                return None
                
            is_3d = False
            first_line_tokens = body_lines[0].strip().split()
            if len(first_line_tokens) == 2 and not AshraeTableParser._is_number(first_line_tokens[0]) and not AshraeTableParser._is_number(first_line_tokens[1]):
                is_3d = True
                y1_var, y2_var = first_line_tokens[0], first_line_tokens[1]
                rows = body_lines[1:]
            else:
                rows = body_lines[1:] if not any(c.isdigit() for c in body_lines[0]) else body_lines
                y_var = body_lines[0].strip() if not any(c.isdigit() for c in body_lines[0]) else "Y"
                
            if is_3d:
                return AshraeTableParser._parse_3d_rows(x_var, x_vals, y1_var, y2_var, rows, title)
            else:
                return AshraeTableParser._parse_2d_rows(x_var, x_vals, rows, title)
                
        return None

    @staticmethod
    def _parse_1d(lines, title):
        num_lines = [l for l in lines if any(c.isdigit() for c in l)]
        if len(num_lines) < 2:
            return None
        x_line = num_lines[0]
        y_line = num_lines[1]
        tokens_x = x_line.split()
        x_vals = []
        for tok in tokens_x:
            tok_clean = tok.rstrip('.')
            m = re.match(r'^([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)(?:\([-+]?\d*\.?\d+\))?$', tok_clean)
            if m:
                x_vals.append(float(m.group(1)))
                
        tokens_y = y_line.split()
        target_vals = []
        for tok in tokens_y:
            tok_clean = tok.rstrip('.')
            m = re.match(r'^([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)$', tok_clean)
            if m:
                target_vals.append(float(m.group(1)))
                
        if len(x_vals) == len(target_vals) and len(x_vals) > 0:
            return {
                'dim': 1,
                'title': title,
                'x': np.array(x_vals, dtype=float),
                'values': np.array(target_vals, dtype=float)
            }
        return None

    @staticmethod
    def _parse_2d_rows(x_var, x_vals, rows, title):
        y_vals = []
        matrix = []
        for r in rows:
            tokens = r.strip().split()
            if not tokens or not any(c.isdigit() for c in tokens[0]):
                continue
            try:
                y = float(tokens[0])
                vals = [float(v) for v in tokens[1:1+len(x_vals)]]
                if len(vals) == len(x_vals):
                    y_vals.append(y)
                    matrix.append(vals)
            except Exception:
                continue
                
        if y_vals and matrix:
            return {
                'dim': 2,
                'title': title,
                'x_var': x_var,
                'x': np.array(x_vals, dtype=float),
                'y': np.array(y_vals, dtype=float),
                'values': np.array(matrix, dtype=float)
            }
        return None

    @staticmethod
    def _parse_3d_rows(x_var, x_vals, y1_var, y2_var, rows, title):
        cur_y1 = None
        grid_entries = []
        for r in rows:
            raw_tokens = r.strip().split()
            if not raw_tokens:
                continue
            # Handle run-together numbers in tables (e.g., 0.0110752026 -> 0.01, 10752026)
            tokens = []
            for tok in raw_tokens:
                m = re.match(r'^(0\.01)([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)$', tok)
                if m:
                    tokens.append(m.group(1))
                    tokens.append(m.group(2))
                else:
                    tokens.append(tok)

            if not any(c.isdigit() for c in tokens[0]):
                continue
            try:
                if len(tokens) == len(x_vals) + 2:
                    cur_y1 = float(tokens[0])
                    y2 = float(tokens[1])
                    vals = [float(v) for v in tokens[2:2+len(x_vals)]]
                elif len(tokens) == len(x_vals) + 1:
                    y2 = float(tokens[0])
                    vals = [float(v) for v in tokens[1:1+len(x_vals)]]
                else:
                    continue
                grid_entries.append((cur_y1, y2, vals))
            except Exception:
                continue
                
        unique_y1 = sorted(list(set(e[0] for e in grid_entries if e[0] is not None)))
        unique_y2 = sorted(list(set(e[1] for e in grid_entries)))
        
        data_3d = np.zeros((len(unique_y1), len(unique_y2), len(x_vals)), dtype=float)
        populated = np.zeros((len(unique_y1), len(unique_y2)), dtype=bool)
        for e in grid_entries:
            if e[0] is not None:
                i = unique_y1.index(e[0])
                j = unique_y2.index(e[1])
                data_3d[i, j, :] = e[2]
                populated[i, j] = True
                
        # Fill unpopulated upper triangle (Db1 >= Db2) with 0.4 as in official AshraeDuct.mdb database
        if 'ED5-4' in title or 'ED5-5' in title or 'ED5-9' in title or 'Db1 > or = Db2' in title:
            for i in range(len(unique_y1)):
                for j in range(len(unique_y2)):
                    if not populated[i, j]:
                        data_3d[i, j, :] = 0.4
                        populated[i, j] = True
        else:
            # Fill ragged/missing y2 coordinates within each y1 slice via linear interpolation
            y2_arr = np.array(unique_y2, dtype=float)
            for i in range(len(unique_y1)):
                pop_indices = [j for j in range(len(unique_y2)) if populated[i, j]]
                if len(pop_indices) >= 2:
                    pop_y2 = y2_arr[pop_indices]
                    for col_k in range(len(x_vals)):
                        pop_vals = data_3d[i, pop_indices, col_k]
                        for j in range(len(unique_y2)):
                            if not populated[i, j]:
                                data_3d[i, j, col_k] = np.interp(y2_arr[j], pop_y2, pop_vals)
                    for j in range(len(unique_y2)):
                        populated[i, j] = True

        return {
            'dim': 3,
            'title': title,
            'x_var': x_var,
            'x': np.array(x_vals, dtype=float),
            'y1_var': y1_var,
            'y1': np.array(unique_y1, dtype=float),
            'y2_var': y2_var,
            'y2': np.array(unique_y2, dtype=float),
            'values': data_3d
        }


def interpolate_1d(x_val, x_arr, val_arr):
    x_val = float(np.clip(x_val, x_arr[0], x_arr[-1]))
    j = max(0, min(np.searchsorted(x_arr, x_val, side='right') - 1, len(x_arr) - 2))
    x0_f, x1_f = np.float32(x_arr[j]), np.float32(x_arr[j+1])
    y0_f, y1_f = np.float32(val_arr[j]), np.float32(val_arr[j+1])
    dx = x1_f - x0_f
    if dx != 0 and x_val != float(x0_f):
        slope = (y1_f - y0_f) / dx
        res = np.float32(float(y0_f) + (x_val - float(x0_f)) * float(slope))
    else:
        res = y0_f
    return float(res)


def interpolate_2d(x_val, y_val, x_arr, y_arr, matrix):
    x_val = float(np.clip(x_val, x_arr[0], x_arr[-1]))
    y_val = float(np.clip(y_val, y_arr[0], y_arr[-1]))
    
    j = max(0, min(np.searchsorted(x_arr, x_val, side='right') - 1, len(x_arr) - 2))
    i = max(0, min(np.searchsorted(y_arr, y_val, side='right') - 1, len(y_arr) - 2))
    
    y0_f, y1_f = np.float32(y_arr[i]), np.float32(y_arr[i+1])
    x0_f, x1_f = np.float32(x_arr[j]), np.float32(x_arr[j+1])
    
    dx = x1_f - x0_f
    dy = y1_f - y0_f
    
    z00_f, z01_f = np.float32(matrix[i, j]), np.float32(matrix[i, j+1])
    z10_f, z11_f = np.float32(matrix[i+1, j]), np.float32(matrix[i+1, j+1])
    
    if dx != 0 and x_val != float(x0_f):
        slope0 = (z01_f - z00_f) / dx
        z0 = np.float32(float(z00_f) + (x_val - float(x0_f)) * float(slope0))
        slope1 = (z11_f - z10_f) / dx
        z1 = np.float32(float(z10_f) + (x_val - float(x0_f)) * float(slope1))
    else:
        z0, z1 = z00_f, z10_f
        
    if dy != 0 and y_val != float(y0_f):
        slope_y = (z1 - z0) / dy
        res = np.float32(float(z0) + (y_val - float(y0_f)) * float(slope_y))
    else:
        res = z0
        
    return float(res)


def interpolate_3d(x_val, y1_val, y2_val, x_arr, y1_arr, y2_arr, cube):
    x_val = float(np.clip(x_val, x_arr[0], x_arr[-1]))
    y1_val = float(np.clip(y1_val, y1_arr[0], y1_arr[-1]))
    y2_val = float(np.clip(y2_val, y2_arr[0], y2_arr[-1]))
    
    k = max(0, min(np.searchsorted(x_arr, x_val, side='right') - 1, len(x_arr) - 2))
    j = max(0, min(np.searchsorted(y2_arr, y2_val, side='right') - 1, len(y2_arr) - 2))
    i = max(0, min(np.searchsorted(y1_arr, y1_val, side='right') - 1, len(y1_arr) - 2))
    
    y1_0, y1_1 = np.float32(y1_arr[i]), np.float32(y1_arr[i+1])
    y2_0, y2_1 = np.float32(y2_arr[j]), np.float32(y2_arr[j+1])
    x0, x1 = np.float32(x_arr[k]), np.float32(x_arr[k+1])
    
    dx = x1 - x0
    dy2 = y2_1 - y2_0
    dy1 = y1_1 - y1_0
    
    c000, c001 = np.float32(cube[i, j, k]), np.float32(cube[i, j, k+1])
    c010, c011 = np.float32(cube[i, j+1, k]), np.float32(cube[i, j+1, k+1])
    c100, c101 = np.float32(cube[i+1, j, k]), np.float32(cube[i+1, j, k+1])
    c110, c111 = np.float32(cube[i+1, j+1, k]), np.float32(cube[i+1, j+1, k+1])
    
    if dx != 0 and x_val != float(x0):
        c00 = np.float32(float(c000) + (x_val - float(x0)) * float((c001 - c000) / dx))
        c01 = np.float32(float(c010) + (x_val - float(x0)) * float((c011 - c010) / dx))
        c10 = np.float32(float(c100) + (x_val - float(x0)) * float((c101 - c100) / dx))
        c11 = np.float32(float(c110) + (x_val - float(x0)) * float((c111 - c110) / dx))
    else:
        c00, c01, c10, c11 = c000, c010, c100, c110
        
    if dy2 != 0 and y2_val != float(y2_0):
        c0 = np.float32(float(c00) + (y2_val - float(y2_0)) * float((c01 - c00) / dy2))
        c1 = np.float32(float(c10) + (y2_val - float(y2_0)) * float((c11 - c10) / dy2))
    else:
        c0, c1 = c00, c10
        
    if dy1 != 0 and y1_val != float(y1_0):
        res = np.float32(float(c0) + (y1_val - float(y1_0)) * float((c1 - c0) / dy1))
    else:
        res = c0
        
    return float(res)


class OfficialAshraeEngine:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.data_dir = os.path.join(self.base_dir, 'ashrae_data')
        self.tbl_dir = os.path.join(self.base_dir, 'ashrae_extracted')
        self.eqs_by_key = {}
        self.constants_list = []
        self.cached_tables = {}
        self._load_metadata()

    def _load_metadata(self):
        eq_file = os.path.join(self.data_dir, 'ashrae_table_Equation.json')
        if os.path.exists(eq_file):
            with open(eq_file, 'r', encoding='utf-8-sig') as f:
                eqs = json.load(f)
            from collections import defaultdict
            self.eqs_by_key = defaultdict(list)
            for eq in eqs:
                if eq.get('Key'):
                    self.eqs_by_key[eq['Key'].strip().upper()].append(eq)

        const_file = os.path.join(self.data_dir, 'ashrae_table_Constants.json')
        if os.path.exists(const_file):
            with open(const_file, 'r', encoding='utf-8-sig') as f:
                self.constants_list = json.load(f)

    def has_fitting_equations(self, key):
        return key.strip().upper() in self.eqs_by_key

    def get_constants(self, unit_system="SI"):
        c = {}
        for row in self.constants_list:
            val = row['SIValue'] if unit_system == "SI" else row['IPValue']
            if val is not None:
                c[row['Variable']] = float(val)
        return c

    def get_tables_for_fitting(self, key):
        if key in self.cached_tables:
            return self.cached_tables[key]
        tbl_file = os.path.join(self.tbl_dir, f"{key}.TBL")
        if not os.path.exists(tbl_file):
            tbl_file = os.path.join(self.tbl_dir, f"{key}.tbl")
        if os.path.exists(tbl_file):
            t = AshraeTableParser.parse_file(tbl_file)
            self.cached_tables[key] = t
            return t
        self.cached_tables[key] = {}
        return {}

    def calculate(self, key, user_inputs, unit_system="SI"):
        env = self.get_constants(unit_system)

        # Standardize and normalize common alias keys
        norm_inputs = {}
        for k, v in user_inputs.items():
            norm_inputs[k] = v
            k_clean = str(k).strip()
            k_lower = k_clean.lower()
            if k_lower in ('r_over_w', 'r/w', 'rr', 'rw', 'radius_ratio'):
                norm_inputs['RR'] = v
            elif k_lower in ('r_over_d', 'r/d', 'rd'):
                norm_inputs['RD'] = v
            elif k_lower in ('theta', 'angle', 'deg'):
                norm_inputs['Theta'] = v
            elif k_lower in ('w', 'width'):
                norm_inputs['W'] = v
            elif k_lower in ('h', 'height'):
                norm_inputs['H'] = v
            elif k_clean == 'D' or k_lower in ('dia', 'diameter'):
                norm_inputs['D'] = v
            elif k_clean in ('d', 'dc') or k_lower in ('hole_dia', 'hole_diameter'):
                norm_inputs['d'] = v
                norm_inputs['dc'] = v
            elif k_lower in ('l_fe', 'lfe', 'l_fully_extended', 'length_fully_extended'):
                norm_inputs['L_FE'] = v
                norm_inputs['LFE'] = v
            elif k_lower in ('q', 'flow', 'flow_rate', 'cfm'):
                norm_inputs['Q'] = v
            elif k_lower in ('l', 'length', 'len'):
                norm_inputs['L'] = v
            elif k_lower in ('e', 'roughness', 'abs_roughness'):
                norm_inputs['e'] = v
                norm_inputs['ei'] = v
            elif k_lower in ('ei',):
                norm_inputs['ei'] = v
                norm_inputs['e'] = v
            elif k_lower in ('rho', 'density'):
                norm_inputs['rho'] = v
                norm_inputs['RHO'] = v
            elif k_lower in ('mu', 'viscosity'):
                norm_inputs['mu'] = v
                norm_inputs['MU'] = v
            for prefix in ('w', 'h', 'd', 'q', 'v', 'a', 'p'):
                for suffix in ('1', '2', '3', 'c', 'b', 's', 'o', 'e'):
                    if k_lower == f"{prefix}{suffix}":
                        norm_inputs[f"{prefix.upper()}{suffix}"] = v

        # Specific aliases preservation
        if 'D' in user_inputs:
            norm_inputs['D'] = user_inputs['D']
        if 'Do' in user_inputs:
            norm_inputs['Do'] = user_inputs['Do']
            if 'D' not in user_inputs:
                norm_inputs['D'] = user_inputs['Do']
        elif 'D' in user_inputs and 'Do' not in norm_inputs:
            norm_inputs['Do'] = user_inputs['D']

        if 'd' in user_inputs:
            norm_inputs['d'] = user_inputs['d']
            norm_inputs['dc'] = user_inputs['d']
        elif 'dc' in user_inputs:
            norm_inputs['dc'] = user_inputs['dc']
            norm_inputs['d'] = user_inputs['dc']

        if 'De' in user_inputs:
            norm_inputs['De'] = user_inputs['De']
        if 'V' in user_inputs:
            norm_inputs['V'] = user_inputs['V']

        if key == 'CF11-1':
            if 'A' in user_inputs and 'W' not in norm_inputs:
                norm_inputs['W'] = user_inputs['A']
            if 'a' in user_inputs and 'H' not in norm_inputs:
                norm_inputs['H'] = user_inputs['a']
            if 'W' in norm_inputs and 'H' in norm_inputs:
                w_val = float(norm_inputs['W'])
                h_val = float(norm_inputs['H'])
                if w_val < h_val:
                    norm_inputs['W'], norm_inputs['H'] = h_val, w_val

        env.update(norm_inputs)
        is_ip = (unit_system == "IP")
        
        tables = self.get_tables_for_fitting(key)
        
        def fcn_eval(*args):
            table_idx = int(args[-1])
            tbl = tables.get(table_idx)
            if not tbl:
                return 0.0
            dim = tbl['dim']
            if dim == 1:
                return interpolate_1d(args[0], tbl['x'], tbl['values'])
            elif dim == 2:
                return interpolate_2d(args[0], args[1], tbl['x'], tbl['y'], tbl['values'])
            elif dim == 3:
                return interpolate_3d(args[0], args[2], args[1], tbl['x'], tbl['y1'], tbl['y2'], tbl['values'])
            return 0.0

        def colebrook_friction(e, D, Re):
            if Re <= 0: return 0.02
            if Re < 2000: return 64.0 / Re
            eps = e / D
            f = 0.02
            for _ in range(50):
                arg = eps / 3.7 + 2.51 / (Re * math.sqrt(f))
                if arg <= 0: break
                f_new = 1.0 / (-2.0 * math.log10(arg))**2
                if abs(f_new - f) < 1e-9: break
                f = f_new
            return f

        functions = {
            'abs': abs, 'ABS': abs, 'Abs': abs,
            'max': max, 'MAX': max, 'Max': max,
            'min': min, 'MIN': min, 'Min': min,
            'sqr': math.sqrt, 'SQR': math.sqrt, 'Sqr': math.sqrt, 'sqrt': math.sqrt, 'SQRT': math.sqrt,
            'atn': math.atan, 'ATN': math.atan, 'Atn': math.atan,
            'tan': math.tan, 'TAN': math.tan, 'Tan': math.tan,
            'sin': math.sin, 'SIN': math.sin, 'Sin': math.sin,
            'cos': math.cos, 'COS': math.cos, 'Cos': math.cos,
            'log': lambda x: math.log(max(float(x), 1e-12)),
            'LOG': lambda x: math.log(max(float(x), 1e-12)),
            'Log': lambda x: math.log(max(float(x), 1e-12)),
            'log10': lambda x: math.log10(max(float(x), 1e-12)),
            'LOG10': lambda x: math.log10(max(float(x), 1e-12)),
            'Log10': lambda x: math.log10(max(float(x), 1e-12)),
            'IFIP': lambda ip_v, si_v: ip_v if is_ip else si_v,
            'ifip': lambda ip_v, si_v: ip_v if is_ip else si_v,
            'Ifip': lambda ip_v, si_v: ip_v if is_ip else si_v,
            'IFLT0': lambda expr, lt0_v, ge0_v: lt0_v if expr < 0 else ge0_v,
            'iflt0': lambda expr, lt0_v, ge0_v: lt0_v if expr < 0 else ge0_v,
            'Iflt0': lambda expr, lt0_v, ge0_v: lt0_v if expr < 0 else ge0_v,
            'IFLE0': lambda expr, le0_v, gt0_v: le0_v if expr <= 0 else gt0_v,
            'ifle0': lambda expr, le0_v, gt0_v: le0_v if expr <= 0 else gt0_v,
            'Ifle0': lambda expr, le0_v, gt0_v: le0_v if expr <= 0 else gt0_v,
            'FRICTION': colebrook_friction, 'friction': colebrook_friction, 'Friction': colebrook_friction,
            'fcn': fcn_eval, 'FCN': fcn_eval, 'Fcn': fcn_eval
        }
        
        eq_list = self.eqs_by_key.get(key.strip().upper(), [])
        eq_list = sorted(eq_list, key=lambda x: x.get('Order', 0))
        
        # Multi-pass evaluation to resolve potential forward dependencies (e.g. SD1-1)
        eval_log = []
        pending = list(eq_list)
        passes = 0
        max_passes = 5
        
        while pending and passes < max_passes:
            passes += 1
            next_pending = []
            progress = False
            for eq_row in pending:
                eq_str = eq_row.get('Equation')
                if not eq_str or '=' not in eq_str:
                    continue
                lhs, rhs = eq_str.split('=', 1)
                lhs = lhs.strip()
                rhs = rhs.strip()
                
                py_rhs = rhs.replace('^', '**').replace('[', '(').replace(']', ')')
                open_p = py_rhs.count('(')
                close_p = py_rhs.count(')')
                if open_p > close_p:
                    py_rhs += ')' * (open_p - close_p)
                
                try:
                    val = eval(py_rhs, {"__builtins__": None}, {**env, **functions})
                    env[lhs] = val
                    eval_log.append((lhs, rhs, val))
                    progress = True
                except Exception as e:
                    next_pending.append((eq_row, lhs, rhs, str(e)))
                    
            if not progress:
                # Log errors for whatever could not be resolved
                for eq_row, lhs, rhs, err in next_pending:
                    eval_log.append((lhs, rhs, f"Error: {err}"))
                break
            pending = [item[0] for item in next_pending]
                
        # Primary loss coefficient and friction factor
        Co = env.get('Co', env.get('Cb', env.get('Cb1', env.get('Cs', env.get('Cp', 0.0)))))
        if isinstance(Co, str): Co = 0.0
        f_val = env.get('f', Co)
        if isinstance(f_val, str): f_val = 0.0
        
        # Velocity and velocity pressure
        Vo = env.get('Vo', env.get('V', env.get('Vc', env.get('Vb', env.get('Vb1', 0.0)))))
        Pvo = env.get('Pvo', env.get('Pv', env.get('Pvc', env.get('Pvb', env.get('Pvb1', 0.0)))))
        Po = env.get('Po', env.get('Pob', env.get('Pob1', env.get('Pos', 0.0))))
        
        # Pressure conversions
        if is_ip:
            pv_in_wg = float(Pvo)
            pv_pa = float(Pvo) * 249.0889
            po_in_wg = float(Po)
            po_pa = float(Po) * 249.0889
            velocity_fpm = float(Vo)
            velocity_ms = float(Vo) / 196.85
        else:
            pv_pa = float(Pvo)
            pv_in_wg = float(Pvo) / 249.0889
            po_pa = float(Po)
            po_in_wg = float(Po) / 249.0889
            velocity_ms = float(Vo)
            velocity_fpm = float(Vo) * 196.85
            
        res = {
            "code": key,
            "loss_coeff_Co": float(Co),
            "f": float(f_val),
            "f_exact": float(f_val),
            "velocity_ms": round(float(velocity_ms), 1),
            "velocity_fpm": round(float(velocity_fpm), 1),
            "pv_pa": round(float(pv_pa)),
            "pv_in_wg": round(float(pv_in_wg), 3),
            "pressure_loss_pa": round(float(po_pa), 1),
            "pressure_loss_in_wg": round(float(po_in_wg), 3),
            "raw_env": {k: float(v) for k, v in env.items() if isinstance(v, (int, float))},
            "eval_log": eval_log
        }
        
        # Extra branch loss fields for tees and wyes
        for suffix in ('', '1', '2'):
            cb_k = f"Cb{suffix}"
            pob_k = f"Pob{suffix}"
            vb_k = f"Vb{suffix}"
            pvb_k = f"Pvb{suffix}"
            if cb_k in env:
                res[cb_k] = float(env[cb_k])
            if pob_k in env:
                val = float(env[pob_k])
                res[f"{pob_k}_pa"] = float(val if not is_ip else val * 249.0889)
                res[f"{pob_k}_in_wg"] = float(val if is_ip else val / 249.0889)
            if vb_k in env:
                val = float(env[vb_k])
                res[f"{vb_k}_ms"] = float(val if not is_ip else val / 196.85)
                res[f"{vb_k}_fpm"] = float(val if is_ip else val * 196.85)
            if pvb_k in env:
                val = float(env[pvb_k])
                res[f"{pvb_k}_pa"] = float(val if not is_ip else val * 249.0889)
                res[f"{pvb_k}_in_wg"] = float(val if is_ip else val / 249.0889)

        if 'Cs' in env:
            res['Cs'] = float(env['Cs'])
        if 'Pos' in env:
            val = float(env['Pos'])
            res['Pos_pa'] = float(val if not is_ip else val * 249.0889)
            res['Pos_in_wg'] = float(val if is_ip else val / 249.0889)
        if 'Vs' in env:
            val = float(env['Vs'])
            res['Vs_ms'] = float(val if not is_ip else val / 196.85)
            res['Vs_fpm'] = float(val if is_ip else val * 196.85)
        if 'Pvs' in env:
            val = float(env['Pvs'])
            res['Pvs_pa'] = float(val if not is_ip else val * 249.0889)
            res['Pvs_in_wg'] = float(val if is_ip else val / 249.0889)
            
        res["steps"] = self.generate_steps(key, norm_inputs, res, unit_system)
        return res

    def generate_steps(self, key, inputs, res, unit_system="SI"):
        u = unit_system
        steps = []
        eval_log = res.get("eval_log", [])
        
        def fmt(n):
            if isinstance(n, (int, float)):
                if abs(n) >= 1000: return f"{n:,.1f}"
                if abs(n) >= 10: return f"{n:.2f}"
                if abs(n) >= 1: return f"{n:.3f}"
                return f"{n:.4f}"
            return str(n)
            
        step_idx = 1
        
        # Step 1: Geometry & Velocity
        geom_lines = []
        for lhs, rhs, val in eval_log:
            if lhs in ['A', 'Ao', 'Ac', 'Ab', 'As', 'A1', 'Vo', 'V', 'Vc', 'Vb', 'Vs', 'V1']:
                geom_lines.append(rf"{lhs} = {rhs} = {fmt(val)}")
        if geom_lines:
            steps.append({
                "step_num": step_idx,
                "step_label": f"STEP {step_idx}",
                "title": "Cross-Sectional Duct Area & Aerodynamic Velocity",
                "citation": "2021 ASHRAE Handbook—Fundamentals Ch. 21, Eq. (10)",
                "governing_latex": r"A = f(D, W, H) \quad ; \quad V = \frac{Q}{1000 A} \tag{21.10}",
                "parameters": [
                    {"symbol": k, "name": f"Input parameter {k}", "value": f"{inputs.get(k)}"}
                    for k in inputs if k != 'rho'
                ],
                "derivation_latex": geom_lines,
                "framed_result_latex": rf"\mathbf{{V = {res.get('velocity_ms' if u=='SI' else 'velocity_fpm')} \text{{ {'m/s' if u=='SI' else 'fpm'}}}}}",
                "notes": f"Governing continuity flow field evaluated using standard air properties ({'1.204 kg/m³' if u=='SI' else '0.075 lbm/ft³'})."
            })
            step_idx += 1

        # Step 2: Velocity Pressure
        pv_lines = []
        for lhs, rhs, val in eval_log:
            if lhs in ['Pv', 'Pvo', 'Pvc', 'Pvb', 'Pvs', 'Pv1']:
                pv_lines.append(rf"{lhs} = {rhs} = {fmt(val)}")
        if pv_lines:
            steps.append({
                "step_num": step_idx,
                "step_label": f"STEP {step_idx}",
                "title": "Mean Velocity Pressure Evaluation",
                "citation": "2021 ASHRAE Handbook—Fundamentals Ch. 21, Eq. (8)",
                "governing_latex": r"p_v = \frac{\rho V^2}{2} = \left(\frac{V}{V_{PC}}\right)^2 \tag{21.8}",
                "parameters": [
                    {"symbol": "V", "name": "Mean Velocity", "value": f"{res.get('velocity_ms' if u=='SI' else 'velocity_fpm')} {'m/s' if u=='SI' else 'fpm'}"},
                    {"symbol": "VPC", "name": "ASHRAE Velocity Pressure Constant", "value": "1.2888" if u == "SI" else "4008.7"}
                ],
                "derivation_latex": pv_lines,
                "framed_result_latex": rf"\mathbf{{P_v = {res.get('pv_pa' if u=='SI' else 'pv_in_wg')} \text{{ {'Pa' if u=='SI' else 'in. wg'}}}}}",
                "notes": "Velocity pressure computed in accordance with official ASHRAE aerodynamic constant formulation."
            })
            step_idx += 1

        # Step 3: Loss Coefficient via Multilinear Interpolation
        coeff_lines = []
        for lhs, rhs, val in eval_log:
            if lhs in ['Co', 'Cb', 'Cs', 'Cp', 'K', 'C1', 'Ccs', 'Ccb']:
                coeff_lines.append(rf"{lhs} = {rhs} = {fmt(val)}")
        if coeff_lines:
            steps.append({
                "step_num": step_idx,
                "step_label": f"STEP {step_idx}",
                "title": f"Loss Coefficient ({key}) via Multilinear Interpolation",
                "citation": f"Official ASHRAE Database Table {key}.TBL",
                "governing_latex": r"C_o = \frac{\Delta p_t}{p_v} = \text{fcn}(Coordinates) \tag{21.29}",
                "parameters": [
                    {"symbol": "Fitting", "name": "Catalog Code", "value": key},
                    {"symbol": "Co", "name": "Interpolated Coefficient", "value": f"{res.get('loss_coeff_Co'):.4f}"}
                ],
                "derivation_latex": coeff_lines,
                "framed_result_latex": rf"\mathbf{{C_o = {res.get('loss_coeff_Co'):.4f}}}",
                "notes": f"Loss coefficient resolved via official multidimensional interpolation table {key}.TBL from ASHRAE laboratory tests."
            })
            step_idx += 1

        # Step 4: Total Pressure Loss
        loss_lines = []
        for lhs, rhs, val in eval_log:
            if lhs in ['Po', 'Pob', 'Pos', 'dp']:
                loss_lines.append(rf"{lhs} = {rhs} = {fmt(val)}")
        if not loss_lines:
            loss_lines.append(rf"\Delta p = C_o \times P_v = {res.get('loss_coeff_Co'):.4f} \times {res.get('pv_pa' if u=='SI' else 'pv_in_wg')} = {res.get('pressure_loss_pa' if u=='SI' else 'pressure_loss_in_wg')}")
        steps.append({
            "step_num": step_idx,
            "step_label": f"STEP {step_idx}",
            "title": "Total Pressure Loss Determination",
            "citation": "2021 ASHRAE Handbook—Fundamentals Ch. 21, Eq. (30)",
            "governing_latex": r"\Delta p_t = C_o \cdot p_v \tag{21.30}",
            "parameters": [
                {"symbol": "Co", "name": "Loss Coefficient", "value": f"{res.get('loss_coeff_Co'):.4f}"},
                {"symbol": "Pv", "name": "Velocity Pressure", "value": f"{res.get('pv_pa' if u=='SI' else 'pv_in_wg')} {'Pa' if u=='SI' else 'in. wg'}"}
            ],
            "derivation_latex": loss_lines,
            "framed_result_latex": rf"\mathbf{{\Delta p = {res.get('pressure_loss_pa' if u=='SI' else 'pressure_loss_in_wg')} \text{{ {'Pa' if u=='SI' else 'in. wg'}}}}}",
            "notes": "Total local dynamic head loss for fitting computed to standard temperature and pressure."
        })

        return steps
