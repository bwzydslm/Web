import re, sys, pathlib

sys.stdout.reconfigure(encoding="utf-8")
root = pathlib.Path(r"D:\DSH work\11")

def strip_js(src: str) -> str:
    """去掉字符串、注释、正则字面量，只留下结构性字符"""
    out, i, n = [], 0, len(src)
    prev_sig = ""            # 上一个有意义字符，用于判断 / 是除法还是正则
    while i < n:
        c = src[i]
        if c in "\"'`":
            q = c
            i += 1
            while i < n:
                if src[i] == "\\":
                    i += 2; continue
                if src[i] == q:
                    i += 1; break
                i += 1
            out.append('""'); prev_sig = '"'; continue
        if c == "/" and i + 1 < n and src[i+1] == "/":
            j = src.find("\n", i)
            i = n if j == -1 else j
            continue
        if c == "/" and i + 1 < n and src[i+1] == "*":
            j = src.find("*/", i + 2)
            i = n if j == -1 else j + 2
            continue
        if c == "/" and (prev_sig in "" or prev_sig in "(,=:[!&|?{};+-*%~^<>") :
            # 正则字面量
            i += 1; in_class = False
            while i < n:
                if src[i] == "\\":
                    i += 2; continue
                if src[i] == "[":
                    in_class = True
                elif src[i] == "]":
                    in_class = False
                elif src[i] == "/" and not in_class:
                    i += 1
                    break
                elif src[i] == "\n":
                    break
                i += 1
            while i < n and src[i].isalpha():
                i += 1
            out.append('//'); prev_sig = "/"; continue
        if not c.isspace():
            prev_sig = c
        out.append(c); i += 1
    return "".join(out)

errors = []

for js in sorted((root / "assets" / "js").glob("*.js")) + sorted((root / "functions").rglob("*.js")):
    code = strip_js(js.read_text(encoding="utf-8"))
    stack, pairs = [], {")": "(", "]": "[", "}": "{"}
    status = "OK"
    for ch in code:
        if ch in "([{":
            stack.append(ch)
        elif ch in ")]}":
            if not stack or stack.pop() != pairs[ch]:
                status = f"FAIL 括号不匹配 near {ch!r}"; break
    if status == "OK" and stack:
        status = f"FAIL 未闭合 {stack[-5:]}"
    if status != "OK":
        errors.append(f"{js.name}: {status}")
    print(f"括号检查 {js.name:18s} {status}")

pages = {
    "index.html": ["app.js", "page-home.js"],
    "wall.html": ["app.js", "page-wall.js"],
    "upload.html": ["app.js", "page-upload.js"],
    "settings.html": ["app.js", "page-settings.js"],
    "404.html": ["app.js"],
}
# 这些 id 由 app.js 在运行时动态插入，不该要求写在 HTML 里
DYNAMIC = {"themeToggle", "collapseBtn", "burgerBtn", "globalSearch", "recentPlaceholder", "loadMoreBtn"}

for page, scripts in pages.items():
    html = (root / page).read_text(encoding="utf-8")
    ids = set(re.findall(r'id="([^"]+)"', html))
    missing = []
    for s in scripts:
        src = (root / "assets" / "js" / s).read_text(encoding="utf-8")
        for need in sorted(set(re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)", src))):
            if need not in ids and need not in DYNAMIC:
                missing.append(f"{s} -> #{need}")
    print(f"元素检查 {page:14s} ids={len(ids):2d} {'OK' if not missing else 'MISSING ' + ', '.join(missing)}")
    if missing:
        errors.append(f"{page}: {missing}")

print()
for page in list(pages):
    html = re.sub(r"<!--.*?-->", "", (root / page).read_text(encoding="utf-8"), flags=re.S)
    for ref in sorted(set(re.findall(r'(?:href|src)="((?!https?:|mailto:|#|/)[^"]+)"', html))):
        if not (root / ref).exists():
            errors.append(f"{page}: 引用了不存在的文件 {ref}")
            print(f"  ! {page} -> {ref}")

# CSS 花括号平衡（顺手查一下样式有没有写漏括号）
css_path = root / "assets" / "css" / "style.css"
css = re.sub(r"/\*.*?\*/", "", css_path.read_text(encoding="utf-8"), flags=re.S)
if css.count("{") != css.count("}"):
    errors.append(f"style.css: 花括号不匹配 {{={css.count('{')} }}={css.count('}')}")
    print(f"CSS 检查 style.css          FAIL {{={css.count('{')} }}={css.count('}')}")
else:
    print(f"CSS 检查 style.css          OK ({css.count('{')} 条规则)")

from html.parser import HTMLParser
VOID = {"area","base","br","col","embed","hr","img","input","link","meta","source","track","wbr"}

class Tagger(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.bad = [], []
    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append((tag, self.getpos()))
    def handle_endtag(self, tag):
        if tag in VOID: return
        if not self.stack:
            self.bad.append(f"多余的 </{tag}> 在第 {self.getpos()[0]} 行"); return
        top, pos = self.stack.pop()
        if top != tag:
            self.bad.append(f"第 {self.getpos()[0]} 行 </{tag}> 与第 {pos[0]} 行 <{top}> 不匹配")

for page in pages:
    t = Tagger()
    t.feed((root / page).read_text(encoding="utf-8"))
    left = [f"<{tag}> 第 {pos[0]} 行" for tag, pos in t.stack]
    ok = not t.bad and not left
    print(f"标签检查 {page:14s} {'OK' if ok else 'FAIL ' + '; '.join(t.bad + left)}")
    if not ok:
        errors.append(f"{page}: {t.bad + left}")

print("\n=== 结果 ===")
if errors:
    for e in errors: print(" -", e)
    sys.exit(1)
print("全部通过。")
