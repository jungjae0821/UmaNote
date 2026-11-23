"""Import cached values from the user's XLSX export; never execute workbook formulas.

Usage: python scripts/import-sheet-rewards.py path/to/export.xlsx
"""
import hashlib
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as E
from pathlib import Path

path = Path(sys.argv[1])
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(path) as z:
    strings = [''.join(i.itertext()) for i in E.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si', ns)]
    rels = {r.attrib['Id']: r.attrib['Target'] for r in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    sheets = {}
    for s in E.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet', ns):
        target = rels[s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']].lstrip('/')
        if not target.startswith('xl/'):
            target = 'xl/' + target
        cells = {}
        for c in E.fromstring(z.read(target)).findall('.//s:sheetData/s:row/s:c', ns):
            v, f = c.find('s:v', ns), c.find('s:f', ns)
            value = v.text if v is not None else None
            if c.attrib.get('t') == 's' and value is not None:
                value = strings[int(value)]
            if value is not None:
                cells[c.attrib['r']] = {'value': value, 'formula': f.text if f is not None else None}
        sheets[s.attrib['name']] = cells

def value(sheet, cell, default=0):
    return sheets[sheet].get(cell, {}).get('value', default)

def number(sheet, cell):
    n = float(value(sheet, cell))
    if not n.is_integer() or n < 0:
        raise ValueError(f'Invalid reward: {sheet}!{cell}')
    return int(n)

def rewards(sheet, row, cols='DEFG'):
    return dict(zip(['free', 'trainTickets', 'supportTickets', 'rainbowShards'], [number(sheet, c + str(row)) for c in cols]))

categories = {
    '챔미 사료': 'cm', '말오스 사료': 'loh', '이벤트 사료': 'story',
    '레전드 레이스 사료': 'legend', '타키온 인자연구 사료': 'research',
    '트레이너 기능 시험 사료': 'exam', '마스터즈 챌린지 사료': 'masters',
    'g1 미션 사료': 'g1', '신캐 사료': 'character-story',
}
rows = []
for sheet, category in categories.items():
    for r in sorted({int(re.sub('[A-Z]', '', c)) for c in sheets[sheet] if re.fullmatch(r'A\d+', c)}):
        if r < 2 or not str(value(sheet, f'A{r}')).replace('.', '', 1).isdigit():
            continue
        name = value(sheet, f'C{r}', '')
        row = dict(id=f'sheet-{category}-{r}', category=category, sheet=sheet, row=r,
                   name=name, startJp=number(sheet, f'A{r}') - 25569,
                   startKr=number(sheet, f'B{r}') - 25569, **rewards(sheet, r, 'DXYZ' if category in ('g1', 'character-story') else 'DEFG'))
        if category in ('story', 'legend', 'research', 'exam', 'masters'):
            row['edition'] = r + 31 if category == 'story' else r + 30 if category == 'legend' else int(re.search(r' (\d+)', name)[1])
        if category in ('cm', 'loh'):
            formula = sheets[sheet][f'D{r}']['formula'] or ''
            row['table'] = 'before' if ('$A$2:' in formula or '$F$2:' in formula) else 'after'
        rows.append(row)

pvp = 'PVP 보상'
cm, loh = {}, {}
for key, start in [('before', 2), ('after', 16)]:
    cm[key] = [{'label': value(pvp, f'A{r}'), **rewards(pvp, r, 'BCDZ')} for r in range(start, start + 12)]
for key, start in [('before', 2), ('after', 8)]:
    loh[key] = [{'label': value(pvp, f'F{r}'), **rewards(pvp, r, 'GHIJ')} for r in range(start, start + 4)]
pass_sheet = '트레이닝 패스'
passes = {key: rewards(pass_sheet, r, 'CDEF') for key, r in [('premium', 2), ('standard', 3)]}
passes['datesKr'] = [number(pass_sheet, f'A{r}') - 25569 for r in range(5, 1000) if str(value(pass_sheet, f'A{r}', '')).replace('.', '', 1).isdigit()]
additional = []
seen = {}
for sheet, prefix in [('기타 잡 사료', 'misc'), ('시나리오, 로그인 사료', 'campaign')]:
    for r in sorted({int(c[1:]) for c in sheets[sheet] if re.fullmatch(r'A\d+', c)}):
        if r < 2 or not str(value(sheet, f'A{r}')).replace('.', '', 1).isdigit():
            continue
        name = value(sheet, f'C{r}', '')
        reward = dict(free=0, trainTickets=0, supportTickets=0, rainbowShards=0, specialTickets={})
        for col, key in zip('DEFG', ['free', 'trainTickets', 'supportTickets', 'rainbowShards']):
            v = value(sheet, f'{col}{r}')
            try:
                reward[key] = int(float(v))
            except ValueError:
                reward['specialTickets'][str(v)] = 1
        note = str(value(sheet, f'H{r}', ''))
        if '확정권' in note and not note.startswith('http'):
            reward['specialTickets'][note] = 1
        role = 'login' if re.search(r'로그인|카운트\s*다운', name) else 'mission' if '미션' in name else 'shop' if re.search(r'숍|상점', name) else 'scenario-score' if '평가점' in name else 'raid' if re.search(r'UMA Summer|우마튜브|Beyond Memories', name) else 'walk' if '우마산책' in name else 'gift'
        row = dict(id=f'sheet-{prefix}-{r}', sheet=sheet, row=r, name=name, role=role,
                   startJp=number(sheet, f'A{r}')-25569, startKr=number(sheet, f'B{r}')-25569, **reward)
        signature = json.dumps([name, row['startJp'], row['startKr'], reward], ensure_ascii=False, sort_keys=True)
        if signature in seen:
            seen[signature].setdefault('duplicateRows', []).append(r)
        else:
            seen[signature] = row
            additional.append(row)
out = dict(reference='https://docs.google.com/spreadsheets/d/19NUeKGgrOprVmuYos0m6I6Bx0Q_JqtHi6aLGqnlLnvA/edit',
           workbookSha256=hashlib.sha256(path.read_bytes()).hexdigest(), rows=rows, additionalRows=additional, cm=cm, loh=loh, trainingPass=passes)
Path('lib/data/sheetRewards.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Imported {len(rows)} event rows, {len(additional)} additional rows, 24 CM results, 8 LOH ranks, {len(passes["datesKr"])} pass dates')
