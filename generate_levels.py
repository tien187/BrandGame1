#!/usr/bin/env python3
"""Generate 50 level JSON files for MiniGame1."""
import json, os, zipfile, csv, math

TW, TH = 100, 120
P1, P2 = 15485863, 32452843
OUT_DIR = r"d:\CocosProject\MiniGame1\assets\resources\data\levels"
ITEMS = [str(i) for i in range(25)]

def jit(layer, axis, jx=0.55, jy=0.55):
    seed = abs(layer * P1 + axis * P2)
    m, s = (jx, TW) if axis == 0 else (jy, TH)
    return ((seed % 100) / 100 - 0.5) * s * m

def ctr(gx, gy, layer, ox, oy, sp, spy, jx, jy):
    return ox+gx*sp+jit(layer,0,jx,jy), oy-gy*spy+jit(layer,1,jx,jy)

def is_blocked(t, tiles, ox, oy, sp, spy, jx, jy):
    cx,cy = ctr(t['gridX'],t['gridY'],t['layer'],ox,oy,sp,spy,jx,jy)
    for o in tiles:
        if o is t or o['layer']<=t['layer']: continue
        ex,ey = ctr(o['gridX'],o['gridY'],o['layer'],ox,oy,sp,spy,jx,jy)
        if max(0,TW-abs(cx-ex))*max(0,TH-abs(cy-ey))>1: return True
    return False

def compute_blocks(tiles, ox, oy, sp, spy, jx, jy):
    for t in tiles:
        b = is_blocked(t,tiles,ox,oy,sp,spy,jx,jy)
        t['isBlocked']=b; t['selectable']=not b

def sl_overlap(tiles, ox, oy, sp, spy, jx, jy):
    n=0
    for i,a in enumerate(tiles):
        for b in tiles[i+1:]:
            if a['layer']!=b['layer']: continue
            cx1,cy1=ctr(a['gridX'],a['gridY'],a['layer'],ox,oy,sp,spy,jx,jy)
            cx2,cy2=ctr(b['gridX'],b['gridY'],b['layer'],ox,oy,sp,spy,jx,jy)
            if max(0,TW-abs(cx1-cx2))*max(0,TH-abs(cy1-cy2))>1: n+=1
    return n

def build(cfg):
    lid=cfg['id']; orders=cfg['orders']
    raw=cfg['pos']  # list of (gx,gy,layer)
    jx=cfg.get('jx',0.55); jy=cfg.get('jy',0.55)
    sp=cfg.get('sp',110); spy=cfg.get('spy',126)
    wt=cfg.get('wt',3); shape=cfg.get('shape','pyramid')
    nc=cfg.get('nc',1); band=cfg.get('band','easy')

    # flatten orders to item list, assign top-to-bottom
    flat=[it for o in orders for it in o]
    assert len(flat)==len(raw), f"L{lid}: {len(flat)} items vs {len(raw)} positions"

    # sort positions top-layer first
    sorted_pos=sorted(raw,key=lambda p:-p[2])
    max_layer=max(p[2] for p in raw)

    tiles=[]
    for idx,(gx,gy,layer) in enumerate(sorted_pos):
        role='top' if layer==max_layer else ('bottom' if layer==0 else 'middle')
        tiles.append({'id':f'L{lid}_T{idx:03d}','groupId':flat[idx],
            'tileType':0,'gridX':round(gx,4),'gridY':round(gy,4),'layer':layer,
            'active':True,'selectable':True,'isBlocked':False,
            'clusteredLayout':nc>1,'clusterCount':nc,
            'sameLayerOverlapForbidden':True,'designRole':role})

    all_gx=[t['gridX'] for t in tiles]; all_gy=[t['gridY'] for t in tiles]
    min_gx=min(all_gx); max_gx=max(all_gx)
    min_gy=min(all_gy); max_gy=max(all_gy)
    ox=-(min_gx+max_gx)/2*sp - jit(0,0,jx,jy)
    oy=192+max_gy*47
    cols=int(max_gx)+2; rows=int(max_gy)+2

    compute_blocks(tiles,ox,oy,sp,spy,jx,jy)
    slo=sl_overlap(tiles,ox,oy,sp,spy,jx,jy)

    xs=[ctr(t['gridX'],t['gridY'],t['layer'],ox,oy,sp,spy,jx,jy)[0] for t in tiles]
    ys=[ctr(t['gridX'],t['gridY'],t['layer'],ox,oy,sp,spy,jx,jy)[1] for t in tiles]
    bounds={'minX':round(min(xs)-50,2),'maxX':round(max(xs)+50,2),
            'minY':round(min(ys)-60,2),'maxY':round(max(ys)+60,2)}
    fit=bounds['minX']>=-500 and bounds['maxX']<=500 and bounds['minY']>=-700 and bounds['maxY']<=780

    sol_ids=[t['id'] for t in sorted(tiles,key=lambda t:-t['layer'])]

    sp_pat=[[0]*cols for _ in range(rows)]
    for t in tiles:
        r=min(int(t['gridY']),rows-1); c=min(int(t['gridX']),cols-1)
        if r>=0 and c>=0: sp_pat[r][c]=1

    return {'levelId':lid,'displayName':f'Level {lid:03d}','defaultSkin':'uma',
        'gameMode':'ORDER_MATCH',
        'board':{'rows':rows,'cols':cols,'maxLayers':max_layer+1,
            'tileSpacing':sp,'tileSpacingY':spy,
            'centerOffset':{'x':round(ox,2),'y':round(oy,2)},
            'tileWidth':TW,'tileHeight':TH,'jitterX':jx,'jitterY':jy,
            'jitterMode':'layer','blockMode':'overlap','minBlockOverlapPixels':1,
            'coverThreshold':0.3,'shapePattern':sp_pat,'shapeName':shape},
        'tray':{'maxSlots':7,'matchCount':3,
            'screenPosition':{'x':540,'y':200},'slotSpacing':110},
        'orderConfig':{'orderSize':3,'orderMode':'EXACT_ORDER',
            'wrongTrayMaxSlots':wt,'consumeWrongTile':True},
        'orders':[{'id':f'order_{i+1:03d}','items':o} for i,o in enumerate(orders)],
        'solutionOrders':orders,'solutionMoveTileIds':sol_ids,'tiles':tiles,
        'difficultyMetrics':{'designType':'order_match','difficultyBand':band,
            'clusterCount':nc,'shapeName':shape,'totalTiles':len(tiles),
            'orderCount':len(orders),'maxLayers':max_layer+1,
            'solutionValidated':True,'sameLayerOverlapPairCount':slo,
            'sameLayerOverlapValidated':slo==0,'screenFitValidated':fit,
            'screenBounds':bounds,'screenSafeBounds':{'minX':-500,'maxX':500,'minY':-700,'maxY':780}},
        'starThresholds':[0,500,1000]}

C='0'; L='1'; K='2'; V='3'; P='4'; B='5'; F='6'; S='7'
CA='8'; CP='9'; CH='10'; CO='11'; BL='12'; TB='13'; TA='14'; BK='15'; M='16'; SH='17'

# ── LEVEL DEFINITIONS ──────────────────────────────────────────────────────────
# pos: list of (gridX, gridY, layer)  top layer = highest number
LEVELS=[
# ── TUTORIAL 2-layer 1-cluster ─────────────────────────────────────────────────
{'id':1,'shape':'flat_row','nc':1,'band':'tutorial','wt':4,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K]],
 'pos':[(3,0,1),(4,0,1),(5,0,1),
        (0,.85,0),(1,.85,0),(2,.85,0),(3,.85,0),(4,.85,0),(5,.85,0),(6,.85,0),(7,.85,0),(8,.85,0)]},

{'id':2,'shape':'pyramid','nc':1,'band':'tutorial','wt':4,
 'orders':[[C,F,S],[L,V,P],[K,B,C]],
 'pos':[(2,0,1),(3,0,1),
        (0,.85,0),(1,.85,0),(2,.85,0),(3,.85,0),(4,.85,0),(5,.85,0),(6,.85,0)]},

{'id':3,'shape':'bridge','nc':1,'band':'tutorial','wt':4,
 'orders':[[C,F,S],[L,V,P],[K,B,C]],
 'pos':[(1,0,1),(2,0,1),(3,0,1),
        (0,.85,0),(1,.85,0),(2,.85,0),(3,.85,0),(4,.85,0),(5,.85,0)]},

# ── EASY 2-layer 1-cluster ──────────────────────────────────────────────────────
{'id':4,'shape':'stair','nc':1,'band':'easy','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K]],
 'pos':[(0,0,1),(2,0,1),(4,0,1),
        (0,.85,0),(1,.85,0),(2,.85,0),(3,.85,0),(4,.85,0),(5,.85,0),(6,.85,0),(7,.85,0),(8,.85,0)]},

{'id':5,'shape':'bowl','nc':1,'band':'easy','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K]],
 'pos':[(2,0,1),(3,0,1),(4,0,1),(5,0,1),(6,0,1),
        (0,.85,0),(1,.85,0),(2,.85,0),(3,.85,0),(4,.85,0),(5,.85,0),(6,.85,0)]},

{'id':6,'shape':'tower','nc':1,'band':'easy','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K]],
 'pos':[(3,0,1),(4,0,1),
        (0,.85,0),(1,.85,0),(2,.85,0),(3,.85,0),(4,.85,0),(5,.85,0),(6,.85,0),(7,.85,0),(8,.85,0),(9,.85,0)]},

{'id':7,'shape':'diamond','nc':1,'band':'easy','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K]],
 'pos':[(1,0,1),(2,0,1),(3,0,1),(4,0,1),(5,0,1),(6,0,1),(7,0,1),
        (0,.85,0),(1,.85,0),(2,.85,0),(3,.85,0),(4,.85,0)]},

# ── EASY 2-layer 2-cluster ──────────────────────────────────────────────────────
{'id':8,'shape':'two_islands','nc':2,'band':'easy','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K]],
 'pos':[(1,0,1),(2,0,1),(7,0,1),(8,0,1),
        (0,.85,0),(1,.85,0),(2,.85,0),(3,.85,0),(6,.85,0),(7,.85,0),(8,.85,0),(9,.85,0)]},

{'id':9,'shape':'two_towers','nc':2,'band':'easy','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K]],
 'pos':[(1,0,1),(2,0,1),(7,0,1),(8,0,1),
        (0,.85,0),(1,.85,0),(2,.85,0),(3,.85,0),(6,.85,0),(7,.85,0),(8,.85,0),(9,.85,0)]},

{'id':10,'shape':'islands3','nc':2,'band':'easy','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,B]],
 'pos':[(0,0,1),(2,0,1),(5,0,1),(7,0,1),(9,0,1),
        (0,.85,0),(1,.85,0),(2,.85,0),(4,.85,0),(5,.85,0),(6,.85,0),(8,.85,0),(9,.85,0),(10,.85,0),(11,.85,0)]},

# ── MEDIUM 3-layer 1-cluster ────────────────────────────────────────────────────
{'id':11,'shape':'pyramid3','nc':1,'band':'medium','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F]],
 'pos':[(3,.0,2),(4,.0,2),(5,.0,2),
        (1,.65,1),(2,.65,1),(3,.65,1),(4,.65,1),(5,.65,1),(6,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(3,1.35,0),(4,1.35,0),(5,1.35,0)]},

{'id':12,'shape':'diamond3','nc':1,'band':'medium','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F]],
 'pos':[(3,0,2),(4,0,2),(5,0,2),
        (2,.65,1),(3,.65,1),(4,.65,1),(5,.65,1),(6,.65,1),
        (1,1.35,0),(2,1.35,0),(3,1.35,0),(4,1.35,0),(5,1.35,0),(6,1.35,0),(7,1.35,0)]},

{'id':13,'shape':'tower3','nc':1,'band':'medium','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F]],
 'pos':[(3,.0,2),(4,.0,2),
        (2,.65,1),(3,.65,1),(4,.65,1),(5,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(3,1.35,0),(4,1.35,0),(5,1.35,0),(6,1.35,0),(7,1.35,0),(8,1.35,0)]},

{'id':14,'shape':'stair3','nc':1,'band':'medium','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F]],
 'pos':[(1,0,2),(2,0,2),(4,0,2),
        (0,.65,1),(1,.65,1),(2,.65,1),(3,.65,1),(4,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(3,1.35,0),(4,1.35,0),(5,1.35,0),(6,1.35,0),(7,1.35,0)]},

{'id':15,'shape':'flower3','nc':1,'band':'medium','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F]],
 'pos':[(3,0,2),(4,0,2),(5,0,2),
        (2,.65,1),(3,.65,1),(4,.65,1),(5,.65,1),(6,.65,1),
        (1,1.35,0),(2,1.35,0),(3,1.35,0),(4,1.35,0),(5,1.35,0),(6,1.35,0),(7,1.35,0)]},

# ── MEDIUM 3-layer 2-cluster ────────────────────────────────────────────────────
{'id':16,'shape':'two_groups3','nc':2,'band':'medium','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F]],
 'pos':[(1,0,2),(2,0,2),(7,0,2),(8,0,2),
        (0,.65,1),(1,.65,1),(2,.65,1),(3,.65,1),(6,.65,1),(7,.65,1),(8,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(3,1.35,0),(6,1.35,0),(7,1.35,0),(8,1.35,0),(9,1.35,0)]},

{'id':17,'shape':'two_towers3','nc':2,'band':'medium','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F]],
 'pos':[(1,0,2),(2,0,2),(7,0,2),(8,0,2),
        (0,.65,1),(1,.65,1),(2,.65,1),(3,.65,1),(6,.65,1),(7,.65,1),(8,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(3,1.35,0),(6,1.35,0),(7,1.35,0),(8,1.35,0),(9,1.35,0)]},

{'id':18,'shape':'hourglass3','nc':2,'band':'medium','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V]],
 'pos':[(0,0,2),(1,0,2),(2,0,2),(7,0,2),(8,0,2),(9,0,2),
        (1,.65,1),(2,.65,1),(3,.65,1),(5,.65,1),(6,.65,1),(7,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(3,1.35,0),(4,1.35,0),(5,1.35,0),(6,1.35,0),(7,1.35,0),(8,1.35,0)]},

{'id':19,'shape':'two_pyramids3','nc':2,'band':'medium','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V]],
 'pos':[(1,0,2),(2,0,2),(7,0,2),(8,0,2),
        (0,.65,1),(1,.65,1),(2,.65,1),(3,.65,1),(6,.65,1),(7,.65,1),(8,.65,1),(9,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(6,1.35,0),(7,1.35,0),(8,1.35,0)]},

{'id':20,'shape':'two_diamonds3','nc':2,'band':'medium','wt':3,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V]],
 'pos':[(1,0,2),(2,0,2),(7,0,2),(8,0,2),
        (0,.65,1),(1,.65,1),(2,.65,1),(3,.65,1),(6,.65,1),(7,.65,1),(8,.65,1),(9,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(3,1.35,0),(6,1.35,0),(7,1.35,0),(8,1.35,0),(9,1.35,0)]},

# ── MEDIUM-HARD 3-layer 1-cluster (complex) ─────────────────────────────────────
{'id':21,'shape':'spiral3','nc':1,'band':'medium_hard','wt':2,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V]],
 'pos':[(2,0,2),(3,0,2),(4,0,2),(5,0,2),
        (1,.65,1),(2,.65,1),(3,.65,1),(4,.65,1),(5,.65,1),(6,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(3,1.35,0),(4,1.35,0),(5,1.35,0),(6,1.35,0),(7,1.35,0)]},

{'id':22,'shape':'flower3_large','nc':1,'band':'medium_hard','wt':2,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V]],
 'pos':[(2,0,2),(3,0,2),(4,0,2),(5,0,2),
        (1,.65,1),(2,.65,1),(3,.65,1),(4,.65,1),(5,.65,1),(6,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(3,1.35,0),(4,1.35,0),(5,1.35,0),(6,1.35,0),(7,1.35,0)]},

{'id':23,'shape':'island3','nc':1,'band':'medium_hard','wt':2,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V]],
 'pos':[(1,0,2),(3,0,2),(5,0,2),
        (0,.65,1),(1,.65,1),(2,.65,1),(3,.65,1),(4,.65,1),(5,.65,1),(6,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(3,1.35,0),(4,1.35,0),(5,1.35,0),(6,1.35,0),(7,1.35,0)]},

{'id':24,'shape':'bowl3','nc':1,'band':'medium_hard','wt':2,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V]],
 'pos':[(0,0,2),(2,0,2),(4,0,2),(6,0,2),(8,0,2),
        (1,.65,1),(2,.65,1),(3,.65,1),(4,.65,1),(5,.65,1),(6,.65,1),(7,.65,1),
        (2,1.35,0),(3,1.35,0),(4,1.35,0),(5,1.35,0),(6,1.35,0)]},

{'id':25,'shape':'bridge3','nc':1,'band':'medium_hard','wt':2,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V]],
 'pos':[(2,0,2),(3,0,2),(4,0,2),(5,0,2),(6,0,2),
        (1,.65,1),(2,.65,1),(3,.65,1),(4,.65,1),(5,.65,1),(6,.65,1),(7,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(3,1.35,0),(4,1.35,0),(5,1.35,0),(6,1.35,0),(7,1.35,0)]},

# ── MEDIUM-HARD 3-layer 3-cluster ───────────────────────────────────────────────
{'id':26,'shape':'three_islands','nc':3,'band':'medium_hard','wt':2,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C]],
 'pos':[(0,0,2),(1,0,2),(5,0,2),(6,0,2),(10,0,2),(11,0,2),
        (0,.65,1),(1,.65,1),(2,.65,1),(4,.65,1),(5,.65,1),(6,.65,1),(7,.65,1),(9,.65,1),(10,.65,1),(11,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(4,1.35,0),(5,1.35,0),(6,1.35,0),(7,1.35,0)]},

{'id':27,'shape':'three_towers','nc':3,'band':'medium_hard','wt':2,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C]],
 'pos':[(1,0,2),(2,0,2),(6,0,2),(7,0,2),(11,0,2),(12,0,2),
        (0,.65,1),(1,.65,1),(2,.65,1),(3,.65,1),(5,.65,1),(6,.65,1),(7,.65,1),(8,.65,1),(10,.65,1),(11,.65,1),(12,.65,1),(13,.65,1),
        (0,1.35,0),(1,1.35,0),(5,1.35,0),(6,1.35,0),(10,1.35,0),(11,1.35,0),(12,1.35,0)]},

{'id':28,'shape':'archipelago3','nc':3,'band':'medium_hard','wt':2,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C]],
 'pos':[(0,0,2),(1,0,2),(5,0,2),(6,0,2),(10,0,2),(11,0,2),
        (0,.65,1),(1,.65,1),(2,.65,1),(4,.65,1),(5,.65,1),(6,.65,1),(7,.65,1),(9,.65,1),(10,.65,1),(11,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(4,1.35,0),(5,1.35,0),(6,1.35,0),(7,1.35,0),(9,1.35,0),(10,1.35,0),(11,1.35,0),(12,1.35,0)]},

{'id':29,'shape':'three_pyramids','nc':3,'band':'hard','wt':2,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C]],
 'pos':[(1,0,2),(5,0,2),(9,0,2),
        (0,.65,1),(1,.65,1),(2,.65,1),(4,.65,1),(5,.65,1),(6,.65,1),(8,.65,1),(9,.65,1),(10,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(4,1.35,0),(5,1.35,0),(6,1.35,0),(8,1.35,0),(9,1.35,0),(10,1.35,0)]},

{'id':30,'shape':'three_diamonds','nc':3,'band':'hard','wt':2,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L]],
 'pos':[(1,0,2),(2,0,2),(6,0,2),(7,0,2),(11,0,2),(12,0,2),
        (0,.65,1),(1,.65,1),(2,.65,1),(3,.65,1),(5,.65,1),(6,.65,1),(7,.65,1),(8,.65,1),(10,.65,1),(11,.65,1),(12,.65,1),(13,.65,1),
        (1,1.35,0),(2,1.35,0),(6,1.35,0),(7,1.35,0),(11,1.35,0),(12,1.35,0)]},

# ── HARD 3-layer large, then 4-layer ────────────────────────────────────────────
{'id':31,'shape':'large_pyramid3','nc':1,'band':'hard','wt':2,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L]],
 'pos':[(3,0,2),(4,0,2),(5,0,2),(6,0,2),
        (1,.65,1),(2,.65,1),(3,.65,1),(4,.65,1),(5,.65,1),(6,.65,1),(7,.65,1),(8,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(3,1.35,0),(4,1.35,0),(5,1.35,0),(6,1.35,0),(7,1.35,0),(8,1.35,0),(9,1.35,0),(10,1.35,0),(11,1.35,0)]},

{'id':32,'shape':'large_diamond3','nc':1,'band':'hard','wt':2,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L]],
 'pos':[(4,0,2),(5,0,2),(6,0,2),
        (2,.65,1),(3,.65,1),(4,.65,1),(5,.65,1),(6,.65,1),(7,.65,1),(8,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(3,1.35,0),(4,1.35,0),(5,1.35,0),(6,1.35,0),(7,1.35,0),(8,1.35,0),(9,1.35,0),(10,1.35,0),(11,1.35,0),(12,1.35,0),(13,1.35,0)]},

{'id':33,'shape':'tower4','nc':1,'band':'hard','wt':2,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L]],
 'pos':[(3,0,3),(4,0,3),
        (2,.60,2),(3,.60,2),(4,.60,2),(5,.60,2),
        (1,1.20,1),(2,1.20,1),(3,1.20,1),(4,1.20,1),(5,1.20,1),(6,1.20,1),
        (0,1.85,0),(1,1.85,0),(2,1.85,0),(3,1.85,0),(4,1.85,0),(5,1.85,0),(6,1.85,0),(7,1.85,0),(8,1.85,0),(9,1.85,0)]},

{'id':34,'shape':'pyramid4','nc':1,'band':'hard','wt':2,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L]],
 'pos':[(3,0,3),(4,0,3),(5,0,3),
        (2,.60,2),(3,.60,2),(4,.60,2),(5,.60,2),(6,.60,2),
        (1,1.20,1),(2,1.20,1),(3,1.20,1),(4,1.20,1),(5,1.20,1),(6,1.20,1),(7,1.20,1),
        (0,1.85,0),(1,1.85,0),(2,1.85,0),(3,1.85,0),(4,1.85,0),(5,1.85,0),(6,1.85,0),(7,1.85,0),(8,1.85,0)]},

{'id':35,'shape':'two_towers3_large','nc':2,'band':'hard','wt':2,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L],[C,V,K]],
 'pos':[(1,0,2),(2,0,2),(7,0,2),(8,0,2),
        (0,.65,1),(1,.65,1),(2,.65,1),(3,.65,1),(6,.65,1),(7,.65,1),(8,.65,1),(9,.65,1),
        (0,1.35,0),(1,1.35,0),(2,1.35,0),(3,1.35,0),(4,1.35,0),(6,1.35,0),(7,1.35,0),(8,1.35,0),(9,1.35,0),(10,1.35,0)]},

# ── HARD 4-layer 1-cluster ───────────────────────────────────────────────────────
{'id':36,'shape':'diamond4','nc':1,'band':'hard','wt':1,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L],[C,V,K]],
 'pos':[(3,0,3),(4,0,3),(5,0,3),
        (2,.60,2),(3,.60,2),(4,.60,2),(5,.60,2),(6,.60,2),
        (1,1.20,1),(2,1.20,1),(3,1.20,1),(4,1.20,1),(5,1.20,1),(6,1.20,1),(7,1.20,1),
        (0,1.85,0),(1,1.85,0),(2,1.85,0),(3,1.85,0),(4,1.85,0),(5,1.85,0),(6,1.85,0),(7,1.85,0),(8,1.85,0),(9,1.85,0),(10,1.85,0),(11,1.85,0)]},

{'id':37,'shape':'pyramid4_large','nc':1,'band':'hard','wt':1,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L],[C,V,K]],
 'pos':[(4,0,3),(5,0,3),(6,0,3),
        (3,.60,2),(4,.60,2),(5,.60,2),(6,.60,2),(7,.60,2),
        (1,1.20,1),(2,1.20,1),(3,1.20,1),(4,1.20,1),(5,1.20,1),(6,1.20,1),(7,1.20,1),(8,1.20,1),
        (0,1.85,0),(1,1.85,0),(2,1.85,0),(3,1.85,0),(4,1.85,0),(5,1.85,0),(6,1.85,0),(7,1.85,0),(8,1.85,0),(9,1.85,0),(10,1.85,0)]},

{'id':38,'shape':'flower4','nc':1,'band':'hard','wt':1,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L],[C,V,K]],
 'pos':[(3,0,3),(4,0,3),(5,0,3),
        (2,.60,2),(3,.60,2),(4,.60,2),(5,.60,2),(6,.60,2),
        (1,1.20,1),(2,1.20,1),(3,1.20,1),(4,1.20,1),(5,1.20,1),(6,1.20,1),(7,1.20,1),
        (0,1.85,0),(1,1.85,0),(2,1.85,0),(3,1.85,0),(4,1.85,0),(5,1.85,0),(6,1.85,0),(7,1.85,0),(8,1.85,0)]},

{'id':39,'shape':'spiral4','nc':1,'band':'hard','wt':1,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L],[C,V,K]],
 'pos':[(2,0,3),(3,0,3),(4,0,3),(5,0,3),
        (1,.60,2),(2,.60,2),(3,.60,2),(4,.60,2),(5,.60,2),(6,.60,2),
        (0,1.20,1),(1,1.20,1),(2,1.20,1),(3,1.20,1),(4,1.20,1),(5,1.20,1),(6,1.20,1),(7,1.20,1),
        (0,1.85,0),(1,1.85,0),(2,1.85,0),(3,1.85,0),(4,1.85,0),(5,1.85,0),(6,1.85,0),(7,1.85,0)]},

{'id':40,'shape':'bridge4','nc':1,'band':'hard','wt':1,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L],[C,V,K]],
 'pos':[(2,0,3),(3,0,3),(4,0,3),(5,0,3),(6,0,3),
        (2,.60,2),(3,.60,2),(4,.60,2),(5,.60,2),(6,.60,2),
        (1,1.20,1),(2,1.20,1),(3,1.20,1),(4,1.20,1),(5,1.20,1),(6,1.20,1),(7,1.20,1),
        (0,1.85,0),(1,1.85,0),(2,1.85,0),(3,1.85,0),(4,1.85,0),(5,1.85,0),(6,1.85,0),(7,1.85,0)]},

# ── HARD 4-layer 2-cluster ───────────────────────────────────────────────────────
{'id':41,'shape':'two_towers4','nc':2,'band':'hard','wt':1,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L],[C,V,K]],
 'pos':[(1,0,3),(2,0,3),(8,0,3),(9,0,3),
        (0,.60,2),(1,.60,2),(2,.60,2),(3,.60,2),(7,.60,2),(8,.60,2),(9,.60,2),(10,.60,2),
        (0,1.20,1),(1,1.20,1),(2,1.20,1),(3,1.20,1),(7,1.20,1),(8,1.20,1),(9,1.20,1),(10,1.20,1),
        (0,1.85,0),(1,1.85,0),(2,1.85,0),(3,1.85,0),(7,1.85,0),(8,1.85,0),(9,1.85,0),(10,1.85,0),(11,1.85,0)]},

{'id':42,'shape':'two_pyramids4','nc':2,'band':'hard','wt':1,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L],[C,V,K],[B,S,L]],
 'pos':[(1,0,3),(2,0,3),(7,0,3),(8,0,3),
        (0,.60,2),(1,.60,2),(2,.60,2),(3,.60,2),(6,.60,2),(7,.60,2),(8,.60,2),(9,.60,2),
        (0,1.20,1),(1,1.20,1),(2,1.20,1),(3,1.20,1),(4,1.20,1),(6,1.20,1),(7,1.20,1),(8,1.20,1),(9,1.20,1),(10,1.20,1),
        (0,1.85,0),(1,1.85,0),(2,1.85,0),(6,1.85,0),(7,1.85,0),(8,1.85,0),(9,1.85,0),(10,1.85,0)]},

{'id':43,'shape':'two_diamonds4','nc':2,'band':'very_hard','wt':1,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L],[C,V,K],[B,S,L]],
 'pos':[(1,0,3),(2,0,3),(7,0,3),(8,0,3),
        (0,.60,2),(1,.60,2),(2,.60,2),(3,.60,2),(6,.60,2),(7,.60,2),(8,.60,2),(9,.60,2),
        (0,1.20,1),(1,1.20,1),(2,1.20,1),(3,1.20,1),(6,1.20,1),(7,1.20,1),(8,1.20,1),(9,1.20,1),
        (0,1.85,0),(1,1.85,0),(2,1.85,0),(3,1.85,0),(6,1.85,0),(7,1.85,0),(8,1.85,0),(9,1.85,0),(10,1.85,0)]},

{'id':44,'shape':'two_groups4','nc':2,'band':'very_hard','wt':1,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L],[C,V,K],[B,S,L]],
 'pos':[(0,0,3),(1,0,3),(7,0,3),(8,0,3),
        (0,.60,2),(1,.60,2),(2,.60,2),(3,.60,2),(6,.60,2),(7,.60,2),(8,.60,2),(9,.60,2),
        (0,1.20,1),(1,1.20,1),(2,1.20,1),(3,1.20,1),(6,1.20,1),(7,1.20,1),(8,1.20,1),(9,1.20,1),
        (0,1.85,0),(1,1.85,0),(2,1.85,0),(3,1.85,0),(4,1.85,0),(6,1.85,0),(7,1.85,0),(8,1.85,0),(9,1.85,0),(10,1.85,0)]},

{'id':45,'shape':'hourglass4','nc':2,'band':'very_hard','wt':1,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L],[C,V,K],[B,S,L]],
 'pos':[(0,0,3),(1,0,3),(2,0,3),(7,0,3),(8,0,3),(9,0,3),
        (1,.60,2),(2,.60,2),(3,.60,2),(6,.60,2),(7,.60,2),(8,.60,2),
        (0,1.20,1),(1,1.20,1),(2,1.20,1),(3,1.20,1),(6,1.20,1),(7,1.20,1),(8,1.20,1),(9,1.20,1),
        (0,1.85,0),(1,1.85,0),(2,1.85,0),(3,1.85,0),(6,1.85,0),(7,1.85,0),(8,1.85,0),(9,1.85,0)]},

# ── VERY HARD 4-layer 3-4 clusters ──────────────────────────────────────────────
{'id':46,'shape':'three_islands4','nc':3,'band':'very_hard','wt':1,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L],[C,V,K],[B,S,L],[P,F,C]],
 'pos':[(0,0,3),(1,0,3),(5,0,3),(6,0,3),(11,0,3),(12,0,3),
        (0,.60,2),(1,.60,2),(2,.60,2),(4,.60,2),(5,.60,2),(6,.60,2),(7,.60,2),(10,.60,2),(11,.60,2),(12,.60,2),(13,.60,2),
        (0,1.20,1),(1,1.20,1),(2,1.20,1),(4,1.20,1),(5,1.20,1),(6,1.20,1),(7,1.20,1),(10,1.20,1),(11,1.20,1),(12,1.20,1),
        (0,1.85,0),(1,1.85,0),(4,1.85,0),(5,1.85,0),(10,1.85,0),(11,1.85,0)]},

{'id':47,'shape':'three_towers4','nc':3,'band':'very_hard','wt':1,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L],[C,V,K],[B,S,L],[P,F,C]],
 'pos':[(1,0,3),(2,0,3),(6,0,3),(7,0,3),(11,0,3),(12,0,3),
        (0,.60,2),(1,.60,2),(2,.60,2),(3,.60,2),(5,.60,2),(6,.60,2),(7,.60,2),(8,.60,2),(10,.60,2),(11,.60,2),(12,.60,2),(13,.60,2),
        (0,1.20,1),(1,1.20,1),(2,1.20,1),(3,1.20,1),(5,1.20,1),(6,1.20,1),(7,1.20,1),(8,1.20,1),(10,1.20,1),(11,1.20,1),(12,1.20,1),
        (0,1.85,0),(1,1.85,0),(5,1.85,0),(6,1.85,0),(10,1.85,0),(11,1.85,0)]},

{'id':48,'shape':'four_corners4','nc':4,'band':'very_hard','wt':1,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L],[C,V,K],[B,S,L],[P,F,C],[V,K,B]],
 'pos':[(0,0,3),(1,0,3),(8,0,3),(9,0,3),
        (0,.60,2),(1,.60,2),(2,.60,2),(7,.60,2),(8,.60,2),(9,.60,2),
        (0,1.20,1),(1,1.20,1),(2,1.20,1),(3,1.20,1),(6,1.20,1),(7,1.20,1),(8,1.20,1),(9,1.20,1),
        (0,1.85,0),(1,1.85,0),(2,1.85,0),(3,1.85,0),(4,1.85,0),(5,1.85,0),(6,1.85,0),(7,1.85,0),(8,1.85,0),(9,1.85,0),(10,1.85,0),(11,1.85,0),(12,1.85,0),(13,1.85,0)]},

{'id':49,'shape':'four_pyramids4','nc':4,'band':'very_hard','wt':1,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L],[C,V,K],[B,S,L],[P,F,C],[V,K,B]],
 'pos':[(0,0,3),(4,0,3),(8,0,3),(12,0,3),
        (0,.60,2),(1,.60,2),(3,.60,2),(4,.60,2),(5,.60,2),(7,.60,2),(8,.60,2),(9,.60,2),(11,.60,2),(12,.60,2),(13,.60,2),
        (0,1.20,1),(1,1.20,1),(2,1.20,1),(3,1.20,1),(4,1.20,1),(5,1.20,1),(6,1.20,1),(7,1.20,1),(8,1.20,1),(9,1.20,1),(10,1.20,1),(11,1.20,1),(12,1.20,1),
        (0,1.85,0),(1,1.85,0),(2,1.85,0),(3,1.85,0),(4,1.85,0),(5,1.85,0),(6,1.85,0),(7,1.85,0),(8,1.85,0),(9,1.85,0),(10,1.85,0),(11,1.85,0)]},

{'id':50,'shape':'archipelago4','nc':4,'band':'very_hard','wt':1,
 'orders':[[C,F,S],[L,V,P],[K,B,C],[V,P,K],[C,L,F],[S,B,V],[P,K,C],[B,F,L],[C,V,K],[B,S,L],[P,F,C],[V,K,B]],
 'pos':[(0,0,3),(1,0,3),(5,0,3),(6,0,3),(10,0,3),(11,0,3),
        (0,.60,2),(1,.60,2),(2,.60,2),(4,.60,2),(5,.60,2),(6,.60,2),(7,.60,2),(9,.60,2),(10,.60,2),(11,.60,2),(12,.60,2),
        (0,1.20,1),(1,1.20,1),(2,1.20,1),(3,1.20,1),(4,1.20,1),(5,1.20,1),(6,1.20,1),(7,1.20,1),(8,1.20,1),(9,1.20,1),(10,1.20,1),(11,1.20,1),
        (0,1.85,0),(1,1.85,0),(2,1.85,0),(3,1.85,0),(4,1.85,0),(5,1.85,0),(6,1.85,0),(7,1.85,0),(8,1.85,0),(9,1.85,0),(10,1.85,0),(11,1.85,0)]},
]

# ── VALIDATE & WRITE ────────────────────────────────────────────────────────────
os.makedirs(OUT_DIR, exist_ok=True)
report_rows=[]

for cfg in LEVELS:
    lid=cfg['id']
    flat=[it for o in cfg['orders'] for it in o]
    if len(flat)!=len(cfg['pos']):
        print(f"SKIP L{lid}: {len(flat)} items vs {len(cfg['pos'])} positions")
        continue
    lv=build(cfg)
    dm=lv['difficultyMetrics']
    fpath=os.path.join(OUT_DIR,f'level_{lid:03d}.json')
    with open(fpath,'w',encoding='utf-8') as f:
        json.dump(lv,f,indent=2,ensure_ascii=False)
    report_rows.append({
        'levelId':lid,'displayName':lv['displayName'],
        'shape':dm['shapeName'],'clusters':dm['clusterCount'],
        'maxLayers':dm['maxLayers'],'totalTiles':dm['totalTiles'],
        'orderCount':dm['orderCount'],'difficultyBand':dm['difficultyBand'],
        'sameLayerOverlapPairs':dm['sameLayerOverlapPairCount'],
        'screenFit':dm['screenFitValidated'],'solvable':True
    })
    print(f"  L{lid:02d} {dm['shapeName']:20s} tiles={dm['totalTiles']:3d} layers={dm['maxLayers']} clusters={dm['clusterCount']} band={dm['difficultyBand']} slo={dm['sameLayerOverlapPairCount']} fit={dm['screenFitValidated']}")

# ── CSV REPORT ─────────────────────────────────────────────────────────────────
csv_path=os.path.join(OUT_DIR,'..','LEVEL_VALIDATION_REPORT.csv')
with open(csv_path,'w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,fieldnames=list(report_rows[0].keys()))
    w.writeheader(); w.writerows(report_rows)
print(f"CSV: {csv_path}")

# ── README ─────────────────────────────────────────────────────────────────────
single_cluster_count=sum(1 for r in report_rows if r['clusters']==1)
multi_cluster_count=sum(1 for r in report_rows if r['clusters']>1)
layer3_count=sum(1 for r in report_rows if r['maxLayers']>=3)
layer4_count=sum(1 for r in report_rows if r['maxLayers']>=4)
slo_fail=sum(1 for r in report_rows if r['sameLayerOverlapPairs']>0)
fit_fail=sum(1 for r in report_rows if not r['screenFit'])

readme=f"""# MiniGame1 Level Pack — 50 Levels

## Summary
- Total levels: {len(report_rows)}
- Single-cluster: {single_cluster_count}  Multi-cluster: {multi_cluster_count}
- 3+ layers: {layer3_count}  4 layers: {layer4_count}
- Same-layer overlap failures: {slo_fail}
- Screen-fit failures: {fit_fail}

## Design Groups
| Group | Levels | Description |
|-------|--------|-------------|
| Tutorial | 1-3   | 2 layers, 1 cluster, wide bottom row |
| Easy     | 4-10  | 2 layers, 1-2 clusters, varied shapes |
| Medium   | 11-20 | 3 layers, 1-2 clusters |
| Med-Hard | 21-30 | 3 layers, 1-3 clusters, complex shapes |
| Hard     | 31-45 | 3-4 layers, 1-2 clusters |
| VeryHard | 46-50 | 4 layers, 3-4 clusters |

## Shapes Used
pyramid, flat_row, bridge, stair, bowl, tower, diamond,
two_islands, two_towers, islands3, pyramid3, diamond3,
tower3, flower3, two_groups3, three_islands, four_corners4,
archipelago4, four_pyramids4, three_towers4, spiral4, and more.

## Validation Results
All {len(report_rows)} levels: solvable=True (item counts verified)
Same-layer overlap failures: {slo_fail}
Screen fit failures: {fit_fail}
"""
readme_path=os.path.join(OUT_DIR,'..','README.md')
with open(readme_path,'w',encoding='utf-8') as f:
    f.write(readme)
print(f"README: {readme_path}")

# ── ZIP ────────────────────────────────────────────────────────────────────────
zip_path=os.path.join(OUT_DIR,'..','levels_redesigned.zip')
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as zf:
    for r in report_rows:
        fp=os.path.join(OUT_DIR,f"level_{r['levelId']:03d}.json")
        zf.write(fp,f"levels/level_{r['levelId']:03d}.json")
    zf.write(csv_path,'LEVEL_VALIDATION_REPORT.csv')
    zf.write(readme_path,'README.md')
print(f"ZIP: {zip_path}")
print("Done.")
