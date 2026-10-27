"""Browser checks for the visual redesign. All order links are intercepted."""
from pathlib import Path
import json
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5187/'
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('visual-artifacts')
OUT.mkdir(parents=True, exist_ok=True)
results, errors = [], []

def check(page, label, width):
    page.wait_for_timeout(80)
    result = page.evaluate('''() => ({width:innerWidth, scroll:document.documentElement.scrollWidth,
      bad:[...document.querySelectorAll('body *')].filter(el=>{
        const r=el.getBoundingClientRect();
        if (!r.width || !r.height || (r.right<=innerWidth+1 && r.left>=-1)) return false;
        for(let p=el.parentElement;p && p!==document.body;p=p.parentElement){
          if(['auto','scroll','hidden'].includes(getComputedStyle(p).overflowX)) return false;
        }
        return true;
      }).slice(0,6).map(e=>({tag:e.tagName,cls:e.className,text:e.innerText?.slice(0,50)}))})''')
    result.update(state=label, viewport=width)
    results.append(result)
    assert result['scroll'] <= width + 1 and not result['bad'], result

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for width,height in [(360,800),(390,844),(430,932),(768,1024),(1280,900),(1920,1080)]:
        ctx = browser.new_context(viewport={'width':width,'height':height}, reduced_motion='reduce')
        # Do not launch WhatsApp or contact any database, including if a future fixture changes.
        ctx.route('**/*supabase*/**', lambda route: route.abort())
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.add_init_script('window.open = (url) => { window.__orderURL = url; return null; };')
        page.goto(BASE, wait_until='networkidle')
        page.locator('#catalog-products-grid article').first.wait_for()
        assert page.locator('#catalog-products-grid article').count() == 21
        page.evaluate("document.querySelectorAll('main img,header img,footer img').forEach(i=>i.loading='eager')")
        page.wait_for_function("[...document.querySelectorAll('main img,header img,footer img')].every(i=>i.complete && i.naturalWidth>0)")
        broken=page.evaluate("[...document.querySelectorAll('main img,header img,footer img')].filter(i=>!i.naturalWidth).map(i=>i.src)")
        assert not broken, broken
        check(page,'catalog-light',width)
        page.screenshot(path=str(OUT/f'{width}-light-top.png'))
        page.locator('#catalog-section-anchor').scroll_into_view_if_needed()
        page.screenshot(path=str(OUT/f'{width}-light-products.png'))
        for currency in ['CUP','MLC','USD']:
            page.locator('.header-actions .js-currency-select').select_option(currency)
            check(page,f'currency-{currency}',width)
        page.evaluate('toggleThemeMode()')
        check(page,'catalog-dark',width)
        page.screenshot(path=str(OUT/f'{width}-dark.png'))
        page.evaluate('toggleLowDataMode()')
        assert page.locator('#catalog-products-grid img').count() == 0
        check(page,'low-data',width)
        page.evaluate('toggleLowDataMode(); toggleThemeMode();')
        page.get_by_role('searchbox').fill('harina')
        assert page.locator('#catalog-products-grid article').count() == 2
        page.get_by_role('searchbox').fill('')
        page.evaluate("filterByVendor('v-wssnd-01')")
        assert page.locator('#catalog-products-grid article').count() == 17
        page.evaluate("activeVendorFilter='ALL'; selectCategory('all');")
        for role in ['EXPORTADOR_B2B','MIPYME','TCP','CLIENTE_B2C','ALL_VIEW']:
            page.evaluate('(role)=>setUserRole(role)',role)
            check(page,f'role-{role}',width)
        page.locator('#catalog-products-grid article button').first.click()
        page.get_by_role('button',name='Abrir carrito').click()
        page.locator('#cart-drawer-modal').wait_for(state='visible')
        check(page,'cart',width)
        page.screenshot(path=str(OUT/f'{width}-cart.png'))
        page.locator('#checkout-customer-name').fill('Prueba visual local')
        page.locator('#cart-drawer-modal').get_by_role('button',name='Comprar',exact=True).click()
        assert page.evaluate("window.__orderURL?.startsWith('https://wa.me/971508379080?text=')")
        page.evaluate('toggleCartDrawer(false)')
        page.evaluate('openDeliveryMapModal()')
        page.locator('#cuba-leaflet-map .leaflet-pane').first.wait_for(state='attached')
        page.locator('#cuba-leaflet-map').wait_for(state='visible')
        check(page,'map',width)
        page.screenshot(path=str(OUT/f'{width}-map.png'))
        page.keyboard.press('Escape')
        assert page.locator('#delivery-map-modal').is_hidden()
        page.evaluate('openAdminModal()')
        check(page,'login',width)
        page.locator('#admin-login-modal button[type=submit]').click()
        for tab in ['catalog','promos','categories','orders','settings']:
            page.evaluate('(tab)=>switchAdminTab("tab-"+tab)',tab)
            check(page,f'admin-{tab}',width)
            if tab in ['catalog','settings']:
                page.screenshot(path=str(OUT/f'{width}-admin-{tab}.png'))
        page.keyboard.press('Escape')
        assert page.locator('#admin-dashboard-modal').is_hidden()
        if width < 1024:
            page.get_by_role('button',name='Abrir Menú').click()
            check(page,'mobile-menu',width)
            page.keyboard.press('Escape')
            assert page.locator('#mobile-drawer').is_hidden()
            assert page.get_by_role('button',name='Abrir Menú').evaluate('(el)=>el===document.activeElement')
        assert page.evaluate("[...document.querySelectorAll('a[aria-label=WhatsApp]')].every(a=>!a.textContent.trim())")
        print(f'{width}x{height}: passed',flush=True)
        ctx.close()
    browser.close()
(OUT/'results.json').write_text(json.dumps({'cases':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'checks':len(results),'errors':errors,'artifacts':str(OUT)}))
assert not errors, errors
