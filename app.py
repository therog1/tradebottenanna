import json, os
from pathlib import Path
import streamlit as st

BASE = Path(__file__).resolve().parent
CONFIG = BASE / 'strategy.json'
DEFAULTS = {'max_open_positions': 2, 'max_margin_fraction': 0.10, 'timeframe': '15m', 'risk_per_trade_pct': 0.25, 'max_leverage': 2, 'min_score': 4, 'atr_stop_multiple': 1.5, 'atr_target_multiple': 3.0}
LIMITS = {
    'max_open_positions': (1, 5), 'max_margin_fraction': (0.01, 0.25),
    'risk_per_trade_pct': (0.05, 0.5), 'max_leverage': (1, 3), 'min_score': (3, 5),
    'atr_stop_multiple': (0.5, 5.0), 'atr_target_multiple': (0.5, 10.0)
}

def load_config():
    try:
        data = json.loads(CONFIG.read_text(encoding='utf-8'))
        return {**DEFAULTS, **data}
    except Exception:
        return DEFAULTS.copy()

def validate(data):
    out = dict(data)
    out['timeframe'] = out.get('timeframe', '15m') if out.get('timeframe') in ('5m','15m','1h','4h') else '15m'
    for key, (low, high) in LIMITS.items():
        val = float(out.get(key, DEFAULTS[key]))
        val = max(low, min(high, val))
        out[key] = int(round(val)) if key in ('max_open_positions','max_leverage','min_score') else round(val, 4)
    # Do not let target be below stop distance; allow flexibility but enforce positive reward/risk.
    if out['atr_target_multiple'] < out['atr_stop_multiple']:
        out['atr_target_multiple'] = out['atr_stop_multiple']
    return out

def save_config(data):
    CONFIG.write_text(json.dumps(validate(data), indent=2) + '\n', encoding='utf-8')

st.set_page_config(page_title='ApexFlash Control', page_icon='⚡', layout='wide')
st.title('⚡ ApexFlash Control Panel')
st.caption('OKX EU · DEMO ONLY · regelbaserad trading · AI används endast som valfri rådgivare')
st.warning('Det här gränssnittet ändrar strategiparametrar. Det startar inte tradingbotten och aktiverar aldrig livehandel. GitHub Actions använder den strategy.json-version som du committar till repot.')
config = load_config()

with st.sidebar:
    st.header('Strategi')
    timeframe = st.selectbox('Tidsram', ['5m','15m','1h','4h'], index=['5m','15m','1h','4h'].index(config['timeframe']))
    min_score = st.slider('Minsta signallpoäng', 3, 5, int(config['min_score']))
    max_positions = st.slider('Max öppna positioner', 1, 5, int(config['max_open_positions']))
    risk = st.slider('Risk per affär (%)', 0.05, 0.50, float(config['risk_per_trade_pct']), 0.05, format='%.2f')
    margin = st.slider('Max kapitalandel som marginal', 0.01, 0.25, float(config['max_margin_fraction']), 0.01, format='%.2f')
    leverage = st.slider('Max hävstång', 1, 3, int(config['max_leverage']))
    stop_atr = st.slider('Stop-loss (ATR ×)', 0.5, 5.0, float(config['atr_stop_multiple']), 0.1)
    target_atr = st.slider('Take-profit (ATR ×)', 0.5, 10.0, max(float(config['atr_target_multiple']), float(config['atr_stop_multiple'])), 0.1)

current = validate({'timeframe':timeframe, 'min_score':min_score, 'max_open_positions':max_positions,
    'risk_per_trade_pct':risk, 'max_margin_fraction':margin, 'max_leverage':leverage,
    'atr_stop_multiple':stop_atr, 'atr_target_multiple':target_atr})

left, right = st.columns([1,1])
with left:
    st.subheader('Aktuella parametrar')
    st.json(current)
    if st.button('Spara inställningar', type='primary', use_container_width=True):
        save_config(current)
        st.success('Sparat till strategy.json i appens miljö. Ladda ner filen och committa den till GitHub för att trading-workflowen ska använda ändringarna.')
    st.download_button('Ladda ner strategy.json', json.dumps(current, indent=2)+'\n', file_name='strategy.json', mime='application/json', use_container_width=True)
with right:
    st.subheader('Gemini – valfri strategirådgivare')
    st.write('Gemini kan föreslå parameterändringar och förklara avvägningar. Den analyserar inte marknaden automatiskt och skickar inga order.')
    api_key = st.text_input('Gemini API-nyckel', value='', type='password', help='Används bara för rådgivning i den här sessionen. Lägg inte in nyckeln i GitHub-koden.')
    question = st.text_area('Vad vill du ha råd om?', value='Föreslå försiktiga parametrar för en regelbaserad demo-strategi. Prioritera låg risk och undvik att överoptimera.', height=100)
    if st.button('Be Gemini om råd', use_container_width=True):
        if not api_key:
            st.error('Ange en Gemini API-nyckel för att använda rådgivaren. Övriga funktioner fungerar utan AI.')
        else:
            try:
                from google import genai
                client = genai.Client(api_key=api_key)
                prompt = f'''Du är rådgivare för en regelbaserad krypto-futures DEMO-bot. Ge inte lönsamhetslöften. Föreslå endast parametrar från det här schemat och håll risk lågt. Begränsningar: risk_per_trade_pct 0.05-0.5; max_open_positions 1-5; max_margin_fraction 0.01-0.25; max_leverage 1-3; min_score 3-5; atr_stop_multiple 0.5-5; atr_target_multiple 0.5-10 and >= stop; timeframe one of 5m,15m,1h,4h. Return JSON with keys advice (string) and proposed_settings (object). Current settings: {json.dumps(current)}. User question: {question}'''
                response = client.models.generate_content(model='gemini-2.5-flash', contents=prompt, config={'response_mime_type':'application/json','temperature':0.2})
                result = json.loads(response.text)
                st.session_state['ai_advice'] = result.get('advice', 'Inga råd returnerades.')
                proposal = result.get('proposed_settings', {})
                st.session_state['ai_proposal'] = validate({**current, **proposal})
            except Exception as exc:
                st.error(f'Gemini-anropet misslyckades: {exc}. Ingen inställning har ändrats.')
    if 'ai_advice' in st.session_state:
        st.info(st.session_state['ai_advice'])
        proposal = st.session_state.get('ai_proposal', current)
        st.caption('Förslag från AI – inget ändras förrän du uttryckligen väljer att använda förslaget.')
        st.json(proposal)
        col_a, col_b = st.columns(2)
        with col_a:
            if st.button('Använd AI-förslag', type='primary', use_container_width=True):
                save_config(proposal)
                st.session_state['accepted_proposal'] = proposal
                st.success('Förslaget sparades till strategy.json. Ladda ner och committa filen till GitHub för att använda det i trading-workflowen.')
        with col_b:
            st.download_button('Ladda ner AI-förslag', json.dumps(proposal, indent=2)+'\n', file_name='strategy.json', mime='application/json', use_container_width=True)

st.divider()
st.subheader('Så används inställningarna')
st.markdown('1. Justera reglagen eller be Gemini om råd.  2. Spara/ladda ner `strategy.json`.  3. Ersätt `strategy.json` i GitHub-repot och committa ändringen.  4. Kör **Actions → ApexFlash OKX EU DEMO — No AI → Run workflow**.')
st.caption('Säkerhetsgränser i botkoden begränsar fortfarande risk, hävstång och antal positioner. AI kan bara föreslå konfigurationsvärden och kan aldrig anropa OKX eller lägga order från dashboarden.')
