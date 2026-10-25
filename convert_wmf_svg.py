import struct
import os
import zipfile

def wmf_to_svg(data):
    if data[:4] == b'\xd7\xcd\xc6\x9a': # APM header
        key, hmf, left, top, right, bottom, inch, res, checksum = struct.unpack('<IhhhhhHIH', data[:22])
        w = max(1, right - left)
        h = max(1, bottom - top)
        pos = 40
    else:
        left, top, w, h = 0, 0, 1000, 1000
        pos = 18

    elements = []
    curr_x, curr_y = 0, 0
    stroke_w = max(1.0, round(w * 0.0011, 1))

    while pos < len(data) - 6:
        size, func = struct.unpack('<IH', data[pos:pos+6])
        if size < 3:
            break
        params = data[pos+6:pos+size*2]

        if func == 0x0325: # POLYLINE
            n = struct.unpack('<H', params[:2])[0]
            pts = struct.unpack(f'<{n*2}h', params[2:2+n*4])
            pts_str = ' '.join(f'{pts[i*2]-left},{pts[i*2+1]-top}' for i in range(n))
            elements.append(f'  <polyline points="{pts_str}" fill="none" stroke="#000000" stroke-width="{stroke_w}" stroke-linecap="round" stroke-linejoin="round" />')
        elif func == 0x0324: # POLYGON
            n = struct.unpack('<H', params[:2])[0]
            pts = struct.unpack(f'<{n*2}h', params[2:2+n*4])
            pts_str = ' '.join(f'{pts[i*2]-left},{pts[i*2+1]-top}' for i in range(n))
            elements.append(f'  <polygon points="{pts_str}" fill="#000000" stroke="#000000" stroke-width="1" />')
        elif func == 0x0214: # MOVETO
            curr_y, curr_x = struct.unpack('<hh', params[:4])
        elif func == 0x0213: # LINETO
            y, x = struct.unpack('<hh', params[:4])
            elements.append(f'  <line x1="{curr_x-left}" y1="{curr_y-top}" x2="{x-left}" y2="{y-top}" stroke="#000000" stroke-width="{stroke_w}" stroke-linecap="round" />')
            curr_x, curr_y = x, y
        elif func == 0x041b: # RECTANGLE
            bottom_r, right_r, top_r, left_r = struct.unpack('<hhhh', params[:8])
            rx = left_r - left
            ry = top_r - top
            rw = right_r - left_r
            rh = bottom_r - top_r
            if rw > 0 and rh > 0 and (rw < w * 0.98 or rh < h * 0.98): # skip canvas frame
                elements.append(f'  <rect x="{rx}" y="{ry}" width="{rw}" height="{rh}" fill="none" stroke="#000000" stroke-width="{stroke_w}" />')
        elif func == 0x0418: # ELLIPSE
            bottom_e, right_e, top_e, left_e = struct.unpack('<hhhh', params[:8])
            cx = (left_e + right_e) / 2.0 - left
            cy = (top_e + bottom_e) / 2.0 - top
            rx = abs(right_e - left_e) / 2.0
            ry = abs(bottom_e - top_e) / 2.0
            elements.append(f'  <ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="none" stroke="#000000" stroke-width="{stroke_w}" />')
        elif func == 0x0538: # POLYPOLYLINE
            n_polys = struct.unpack('<H', params[:2])[0]
            pt_counts = struct.unpack(f'<{n_polys}H', params[2:2+n_polys*2])
            offset = 2 + n_polys * 2
            for count in pt_counts:
                pts = struct.unpack(f'<{count*2}h', params[offset:offset+count*4])
                pts_str = ' '.join(f'{pts[i*2]-left},{pts[i*2+1]-top}' for i in range(count))
                elements.append(f'  <polyline points="{pts_str}" fill="none" stroke="#000000" stroke-width="{stroke_w}" stroke-linecap="round" stroke-linejoin="round" />')
                offset += count * 4
        elif func == 0x0a32: # EXTTEXTOUT
            y_t, x_t, count_t, _ = struct.unpack('<hhhh', params[:8])
            txt = params[8:8+count_t].decode('latin1', 'ignore').strip()
            font_size = round(h * 0.032)
            elements.append(f'  <text x="{x_t-left}" y="{y_t-top+font_size}" font-family="Arial, Segoe UI, sans-serif" font-size="{font_size}" font-weight="bold" fill="#000000">{txt}</text>')

        pos += size * 2
        if func == 0:
            break

    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid meet">\n' + '\n'.join(elements) + '\n</svg>'
    return svg, (w, h)

def convert_all_wmf():
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "fittings_svg")
    os.makedirs(out_dir, exist_ok=True)
    
    zip_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Duct Fitting Database", "AshraeDuct.zip")
    if not os.path.exists(zip_path):
        print("Zip not found:", zip_path)
        return
        
    zf = zipfile.ZipFile(zip_path, 'r')
    count = 0
    for name in zf.namelist():
        if name.lower().endswith('.wmf'):
            try:
                data = zf.read(name, pwd=b"ashraeopenup")
                svg, (w, h) = wmf_to_svg(data)
                code = os.path.splitext(os.path.basename(name))[0].upper()
                out_path = os.path.join(out_dir, f"{code}.svg")
                with open(out_path, 'w', encoding='utf-8') as f:
                    f.write(svg)
                count += 1
            except Exception as e:
                print(f"Error on {name}: {e}")
                
    print(f"Successfully converted {count} official vector blueprints to pure scalable SVG in {out_dir}!")

if __name__ == '__main__':
    convert_all_wmf()
