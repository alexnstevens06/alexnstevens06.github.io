#!/usr/bin/env python3
"""Measure first-load weight of dist pages: HTML + every referenced asset
(img src, first <source> in <picture>, link stylesheet/icon/preload, script src,
video poster; video src only if autoplay or preload!=none; CSS url() refs)."""
import sys, os, re, html
from html.parser import HTMLParser
from urllib.parse import unquote, urlparse
DIST = sys.argv[1]
PAGES = sys.argv[2:] or ['/', '/timeline/', '/projects/', '/projects/comparator/']

class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.refs=[]; s.pic=False; s.pic_src=False; s.video=None
    def handle_starttag(s, t, a):
        a = dict(a)
        if t=='picture': s.pic=True; s.pic_src=False
        elif t=='source' and s.pic:
            if not s.pic_src and a.get('srcset'):
                s.refs.append(('picture-source', pick(a['srcset']))); s.pic_src=True
        elif t=='img':
            if s.pic and s.pic_src: return  # browser uses the <source>
            if a.get('srcset'): s.refs.append(('img-srcset', pick(a['srcset'])))
            elif a.get('src'): s.refs.append(('img', a['src']))
        elif t=='link' and a.get('href') and any(r in (a.get('rel') or '') for r in ('stylesheet','icon','preload','modulepreload')):
            s.refs.append(('link', a['href']))
        elif t=='script' and a.get('src'): s.refs.append(('script', a['src']))
        elif t=='video':
            s.video=a
            if a.get('poster'): s.refs.append(('poster', a['poster']))
            if a.get('src') and ('autoplay' in a or a.get('preload')!='none'): s.refs.append(('video', a['src']))
        elif t=='source' and s.video is not None:
            v=s.video
            if a.get('src') and ('autoplay' in v or v.get('preload')!='none'): s.refs.append(('video', a['src']))
    def handle_endtag(s, t):
        if t=='picture': s.pic=False
        if t=='video': s.video=None

def pick(srcset):
    # conservative: largest candidate
    c=[x.strip().split() for x in srcset.split(',') if x.strip()]
    def w(x): 
        return float(x[1][:-1]) if len(x)>1 and x[1][-1] in 'wx' else 1
    return max(c, key=w)[0]

def fpath(url, base):
    u = urlparse(html.unescape(url))
    if u.scheme or u.netloc: return None
    p = unquote(u.path)
    if not p.startswith('/'): p = os.path.join(os.path.dirname(base), p)
    f = os.path.join(DIST, p.lstrip('/'))
    if os.path.isdir(f): f = os.path.join(f, 'index.html')
    return f

total_ok=True
for page in PAGES:
    hp = os.path.join(DIST, page.lstrip('/'), 'index.html')
    src = open(hp, encoding='utf8').read()
    p = P(); p.feed(src)
    seen = {}; missing=[]
    for kind, url in p.refs:
        f = fpath(url, page)
        if not f: continue
        if not os.path.exists(f): missing.append(url); continue
        seen[f]=kind
        if f.endswith('.css'):
            for m in re.findall(r'url\(\s*["\']?([^"\')]+)', open(f).read()):
                g = fpath(m, '/' + os.path.relpath(f, DIST))
                if g and os.path.exists(g): seen[g]='css-url'
    # inline <style> url() refs
    for m in re.findall(r'url\(\s*["\']?([^"\')]+)', ''.join(re.findall(r'<style[^>]*>(.*?)</style>', src, re.S))):
        g = fpath(m, page)
        if g and os.path.exists(g): seen[g]='css-url'
    htmlb = os.path.getsize(hp); assets = sum(os.path.getsize(f) for f in seen)
    print(f"{page:28s} html={htmlb/1024:7.1f}KB assets={assets/1024:7.1f}KB ({len(seen)} files) TOTAL={(htmlb+assets)/1024:7.1f}KB")
    if '-v' in os.environ.get('MEASURE_FLAGS',''):
        for f,k in sorted(seen.items(), key=lambda x:-os.path.getsize(x[0])):
            print(f"    {os.path.getsize(f)/1024:7.1f}KB {k:14s} {os.path.relpath(f,DIST)}")
    if missing: print("    MISSING:", missing)
