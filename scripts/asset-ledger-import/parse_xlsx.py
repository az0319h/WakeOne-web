"""plan 103 — 엑셀(.xlsx) → JSON 변환기 (Python stdlib만 · `python3 -I`로 실행).

사용: python3 -I parse_xlsx.py <원본.xlsx> <출력.json>

- 원본은 읽기만 한다(수정·이동·복사 금지).
- 출력 JSON은 호출자(run.mjs)가 os.tmpdir() 아래 임시 경로를 넘기고, 끝나면 삭제한다.
- 값을 콘솔에 출력하지 않는다(비밀번호 의심 칸이 섞여 있을 수 있다). 출력은 시트 수·행 수 요약 1줄뿐.

출력 형식:
{
  "sheets": [
    {"name": "시트명", "rows": [{"r": 3, "c": {"A": {"t": "s", "v": "..."}, "B": {"t": "n", "v": 1, "f": "#,##0"}}}]}
  ]
}
셀 t: s(문자) · n(숫자, f=숫자 서식 코드) · d(날짜 서식 숫자 → "YYYY-MM-DD") · b(불리언)
"""

import datetime
import json
import posixpath
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
}
R_ID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"

BUILTIN_DATE_IDS = set(range(14, 23)) | {45, 46, 47}
BUILTIN_FORMATS = {
    0: "General",
    1: "0",
    2: "0.00",
    3: "#,##0",
    4: "#,##0.00",
    9: "0%",
    10: "0.00%",
    14: "yyyy-mm-dd",
}


def text_of(node):
    """<si>/<is> 안의 모든 <t> 텍스트를 이어 붙인다(rich text 포함)."""
    if node is None:
        return ""
    parts = []
    for t in node.iter("{%s}t" % NS["m"]):
        parts.append(t.text or "")
    return "".join(parts)


def is_date_format(code):
    if not code:
        return False
    cleaned = re.sub(r'"[^"]*"', "", code)
    cleaned = re.sub(r"\[[^\]]*\]", "", cleaned)
    cleaned = cleaned.replace("\\", "")
    lowered = cleaned.lower()
    if "general" in lowered:
        return False
    return bool(re.search(r"[ymd]", lowered))


def excel_serial_to_date(value):
    try:
        serial = float(value)
    except (TypeError, ValueError):
        return None
    if serial <= 0 or serial > 2958465:
        return None
    base = datetime.datetime(1899, 12, 30)
    return (base + datetime.timedelta(days=int(serial))).date().isoformat()


def col_letters(ref):
    match = re.match(r"([A-Z]+)(\d+)", ref or "")
    if not match:
        return None, None
    return match.group(1), int(match.group(2))


def load_shared_strings(archive):
    try:
        data = archive.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ET.fromstring(data)
    return [text_of(si) for si in root.findall("m:si", NS)]


def load_styles(archive):
    """cellXfs 인덱스 → (numFmtId, formatCode)."""
    try:
        data = archive.read("xl/styles.xml")
    except KeyError:
        return []
    root = ET.fromstring(data)
    custom = {}
    num_fmts = root.find("m:numFmts", NS)
    if num_fmts is not None:
        for fmt in num_fmts.findall("m:numFmt", NS):
            custom[int(fmt.get("numFmtId"))] = fmt.get("formatCode") or ""
    xfs = []
    cell_xfs = root.find("m:cellXfs", NS)
    if cell_xfs is not None:
        for xf in cell_xfs.findall("m:xf", NS):
            fmt_id = int(xf.get("numFmtId") or 0)
            code = custom.get(fmt_id) or BUILTIN_FORMATS.get(fmt_id) or ""
            xfs.append((fmt_id, code))
    return xfs


def load_sheet_paths(archive):
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {}
    for rel in rels.findall("pr:Relationship", NS):
        target = rel.get("Target") or ""
        if target.startswith("/"):
            path = target.lstrip("/")
        else:
            path = posixpath.normpath(posixpath.join("xl", target))
        targets[rel.get("Id")] = path
    sheets = []
    for sheet in workbook.findall("m:sheets/m:sheet", NS):
        sheets.append((sheet.get("name") or "", targets.get(sheet.get(R_ID))))
    return sheets


def parse_cell(cell, shared, styles):
    cell_type = cell.get("t") or "n"
    style_index = int(cell.get("s") or 0)
    fmt_id, fmt_code = styles[style_index] if style_index < len(styles) else (0, "")
    value_node = cell.find("m:v", NS)
    raw = value_node.text if value_node is not None else None

    if cell_type == "s":
        if raw is None:
            return None
        index = int(raw)
        text = shared[index] if index < len(shared) else ""
        return {"t": "s", "v": text} if text != "" else None
    if cell_type == "inlineStr":
        text = text_of(cell.find("m:is", NS))
        return {"t": "s", "v": text} if text != "" else None
    if cell_type == "str":
        return {"t": "s", "v": raw} if raw not in (None, "") else None
    if cell_type == "b":
        return {"t": "b", "v": raw == "1"} if raw is not None else None
    if cell_type == "e":
        return None
    if raw is None or raw == "":
        return None
    if fmt_id in BUILTIN_DATE_IDS or is_date_format(fmt_code):
        iso = excel_serial_to_date(raw)
        if iso:
            return {"t": "d", "v": iso}
    try:
        number = float(raw)
        if number.is_integer():
            number = int(number)
    except ValueError:
        return {"t": "s", "v": raw}
    return {"t": "n", "v": number, "f": fmt_code}


def parse_workbook(path):
    with zipfile.ZipFile(path) as archive:
        shared = load_shared_strings(archive)
        styles = load_styles(archive)
        result = []
        for name, sheet_path in load_sheet_paths(archive):
            if not sheet_path:
                continue
            root = ET.fromstring(archive.read(sheet_path))
            rows = []
            for row in root.findall("m:sheetData/m:row", NS):
                row_number = int(row.get("r") or 0)
                cells = {}
                for cell in row.findall("m:c", NS):
                    letters, number = col_letters(cell.get("r"))
                    if not letters:
                        continue
                    parsed = parse_cell(cell, shared, styles)
                    if parsed is not None:
                        cells[letters] = parsed
                        row_number = row_number or number
                if cells:
                    rows.append({"r": row_number, "c": cells})
            merges = [m.get("ref") for m in root.findall("m:mergeCells/m:mergeCell", NS) if m.get("ref")]
            result.append({"name": name, "rows": rows, "merges": merges})
        return result


def main(argv):
    if len(argv) != 3:
        sys.stderr.write("usage: parse_xlsx.py <input.xlsx> <output.json>\n")
        return 2
    sheets = parse_workbook(argv[1])
    with open(argv[2], "w", encoding="utf-8") as handle:
        json.dump({"sheets": sheets}, handle, ensure_ascii=False)
    total_rows = sum(len(sheet["rows"]) for sheet in sheets)
    sys.stdout.write("parsed sheets=%d rows=%d\n" % (len(sheets), total_rows))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
