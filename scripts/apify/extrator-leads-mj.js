// pageFunction of the Apify task "extrator-leads-mj" (actor apify/puppeteer-scraper).
// Source of truth for the task input: keep this file and the task in sync.
//
// Custom data (task input → customData):
//   capsolverKey          CapSolver key (required)
//   distritos             ["Lisboa", "Porto"] or omitted/[] for every district
//   periodo               "ontem" (default), "hoje" or "ontem-hoje"
//   apenasConstituicoes   true to keep only company constitutions (default false)
//
// The portal caps every search at 200 results and each search needs a new
// reCAPTCHA, so the search is split per district. Output: one row per company
// { data, nif, entidade, concelho, acto, texto, cae }.
//
// Task options: memory 4096 MB (2048 MB is ~5x slower), timeout 5400 s,
// pageFunctionTimeoutSecs 5400, maxRequestRetries 0 (a retry would redo every district).
// Runs daily at 06:00 Europe/Lisbon (Apify schedule "p2g-mj-prospects-diario"); the
// webhook calls the Edge Function mj-prospects-webhook, which imports the results.
async function pageFunction(context) {
    const { page, log, customData = {} } = context;

    const CAPSOLVER_KEY = customData.capsolverKey;
    const SITE_URL = 'https://publicacoes.mj.pt/Pesquisa.aspx';
    const SITE_KEY = '6LfWfwkTAAAAAF_tbbsmS54u0N7kpwdWF_kxp3Ks';
    const API = 'https://api.capsolver.com';
    const PREFIXO = 'ctl00_ContentPlaceHolderMain_';
    const TABELA = `#${PREFIXO}gvSearchResult`;
    const GRID = 'ctl00$ContentPlaceHolderMain$gvSearchResult';
    const LIMITE_PORTAL = 200;

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    if (!CAPSOLVER_KEY) throw new Error('Configura capsolverKey no Custom data do Apify.');

    async function api(endpoint, payload) {
        const response = await fetch(`${API}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`CapSolver HTTP ${response.status}`);
        const data = await response.json();
        if (data.errorId !== 0) throw new Error(`CapSolver: ${data.errorCode || data.errorDescription}`);
        return data;
    }

    // 1. SALDO
    const conta = await api('getBalance', { clientKey: CAPSOLVER_KEY });
    log.info(`Saldo CapSolver: $${conta.balance}`);
    if (Number(conta.balance) <= 0) throw new Error('CapSolver sem saldo disponível.');

    // 2. DATAS EM PORTUGAL
    const partes = Object.fromEntries(
        new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', day: '2-digit', month: '2-digit', year: 'numeric' })
            .formatToParts(new Date()).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
    );
    const pad = n => String(n).padStart(2, '0');
    const hoje = new Date(Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day)));
    const ontem = new Date(hoje.getTime() - 86400000);
    const formatar = d => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
    const periodo = customData.periodo || 'ontem';
    const inicio = formatar(periodo === 'hoje' ? hoje : ontem);
    const fim = formatar(periodo === 'ontem' ? ontem : hoje);
    log.info(`Pesquisa comercial: ${inicio} a ${fim}`);

    async function resolverCaptcha() {
        const tarefa = await api('createTask', {
            clientKey: CAPSOLVER_KEY,
            task: { type: 'ReCaptchaV2TaskProxyLess', websiteURL: SITE_URL, websiteKey: SITE_KEY },
        });
        if (!tarefa.taskId) throw new Error('CapSolver não devolveu um taskId.');
        for (let tentativa = 1; tentativa <= 30; tentativa++) {
            await sleep(4000);
            const resultado = await api('getTaskResult', { clientKey: CAPSOLVER_KEY, taskId: tarefa.taskId });
            if (resultado.status === 'ready') return resultado.solution?.gRecaptchaResponse;
        }
        throw new Error('CAPTCHA não resolvido em 120 segundos.');
    }

    const esperarNavegacao = timeout => page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout }).catch(() => null);

    // 3. UMA PESQUISA (um distrito, opcionalmente um concelho)
    async function pesquisar(distrito, concelho) {
        await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector(`#${PREFIXO}txtDataInit`, { timeout: 30000 });
        const nav = esperarNavegacao(7000);
        await page.click(`#${PREFIXO}rblTipoPub_1`);
        await nav;
        await page.waitForSelector(`#${PREFIXO}txtDataInit`);

        await page.waitForSelector(`#${PREFIXO}comboDadosPubDistrito`);
        const navDistrito = esperarNavegacao(7000);
        await page.select(`#${PREFIXO}comboDadosPubDistrito`, distrito.valor);
        await navDistrito;
        await page.waitForSelector(`#${PREFIXO}txtDataInit`);

        if (concelho) {
            await page.waitForSelector(`#${PREFIXO}comboDadosPubConcelho option[value="${concelho.valor}"]`, { timeout: 15000 });
            const navConcelho = esperarNavegacao(7000);
            await page.select(`#${PREFIXO}comboDadosPubConcelho`, concelho.valor);
            await navConcelho;
            await page.waitForSelector(`#${PREFIXO}txtDataInit`);
        }

        await page.evaluate((dataInicio, dataFim) => {
            for (const [id, valor] of [['ctl00_ContentPlaceHolderMain_txtDataInit', dataInicio], ['ctl00_ContentPlaceHolderMain_txtDataFim', dataFim]]) {
                const campo = document.getElementById(id);
                if (!campo) throw new Error(`Campo ${id} não encontrado`);
                campo.value = valor;
                for (const evento of ['input', 'change', 'blur']) campo.dispatchEvent(new Event(evento, { bubbles: true }));
            }
        }, inicio, fim);

        const token = await resolverCaptcha();
        await page.evaluate(valor => {
            let campos = document.querySelectorAll('#g-recaptcha-response, textarea[name="g-recaptcha-response"]');
            if (!campos.length) {
                const campo = document.createElement('textarea');
                campo.name = 'g-recaptcha-response';
                campo.style.display = 'none';
                document.forms[0].appendChild(campo);
                campos = [campo];
            }
            campos.forEach(campo => { campo.value = valor; });
        }, token);

        const navPesquisa = esperarNavegacao(20000);
        await page.click(`#${PREFIXO}btSearch`);
        await navPesquisa;
        await sleep(1000);
        return page.evaluate((seletor, idConcelho) => {
            const texto = document.body.innerText;
            const total = (texto.match(/Resultado da pesquisa \((\d+)-(\d+) de (\d+)\)/) || [])[3];
            const concelhos = Array.from(document.querySelectorAll(`#${idConcelho} option`))
                .filter(o => o.value && o.value !== 'null').map(o => ({ valor: o.value, nome: o.textContent.trim() }));
            const semResultados = /n[ãa]o (foram encontrad|existem)|sem resultados/i.test(texto);
            const aviso = (texto.match(/[^\n]*(captcha|inv[áa]lid|erro|n[ãa]o foram encontrad|sem resultados)[^\n]*/i) || [''])[0].trim().slice(0, 160);
            return { temTabela: !!document.querySelector(seletor), total: total ? Number(total) : 0, concelhos, semResultados, aviso };
        }, TABELA, `${PREFIXO}comboDadosPubConcelho`);
    }

    const postback = arg => page.evaluate(async (alvo, argumento, seletor) => {
        const form = document.forms[0];
        form.__EVENTTARGET.value = alvo;
        form.__EVENTARGUMENT.value = argumento;
        const res = await fetch(form.action, { method: 'POST', body: new URLSearchParams(new FormData(form)), credentials: 'include' });
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        for (const nome of ['__VIEWSTATE', '__EVENTVALIDATION', '__VIEWSTATEGENERATOR']) {
            const novo = doc.querySelector(`[name="${nome}"]`);
            const atual = form.querySelector(`[name="${nome}"]`);
            if (novo && atual) atual.value = novo.value;
        }
        const tabela = doc.querySelector(seletor);
        const tabelaAtual = document.querySelector(seletor);
        if (tabela && tabelaAtual) tabelaAtual.outerHTML = tabela.outerHTML;
        return res.ok;
    }, GRID, arg, TABELA);

    const linhas = () => page.evaluate(seletor => Array.from(document.querySelectorAll(`${seletor} tr`)).slice(1)
        .filter(linha => linha.querySelectorAll('td').length > 4)
        .map((linha, i) => {
            const c = linha.querySelectorAll('td');
            return { i, data: c[0].innerText.trim(), nif: c[1].innerText.trim(), entidade: c[2].innerText.trim(), concelho: c[3].innerText.trim(), acto: c[4].innerText.trim() };
        }), TABELA);

    const detalhe = () => page.evaluate(async () => {
        const res = await fetch('DetalhePublicacao.aspx', { credentials: 'include' });
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        doc.querySelectorAll('script,style,noscript').forEach(e => e.remove());
        const caixa = document.createElement('div');
        caixa.style.cssText = 'position:absolute;left:-99999px;top:0;width:1200px';
        caixa.innerHTML = doc.body.innerHTML;
        document.body.appendChild(caixa);
        const texto = caixa.innerText;
        caixa.remove();
        const inicio = texto.indexOf('Publica-se');
        const fim = texto.indexOf('Desenvolvimento:');
        return texto.slice(inicio < 0 ? 0 : inicio, fim < 0 ? undefined : fim).trim();
    });

    // 4. DISTRITOS
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const todos = await page.evaluate(id => Array.from(document.querySelectorAll(`#${id} option`))
        .filter(o => o.value && o.value !== 'null').map(o => ({ valor: o.value, nome: o.textContent.trim() })), `${PREFIXO}comboDadosPubDistrito`);
    const pedidos = Array.isArray(customData.distritos) && customData.distritos.length
        ? todos.filter(d => customData.distritos.some(n => n.toLowerCase() === d.nome.toLowerCase()))
        : todos;
    if (!pedidos.length) throw new Error('Nenhum distrito corresponde ao Custom data "distritos".');

    const empresas = new Map();
    const constituicao = acto => /Constitui/i.test(acto || '');
    const avisos = [];

    async function processar(total) {
        for (let lidas = 0; lidas < total;) {
            const pagina = await linhas();
            if (!pagina.length) break;
            for (const linha of pagina) {
                const nif = linha.nif.replace(/\D/g, '');
                if (nif.length !== 9) continue;
                if (customData.apenasConstituicoes && !constituicao(linha.acto)) continue;
                const existente = empresas.get(nif);
                if (existente && (constituicao(existente.acto) || !constituicao(linha.acto))) continue;
                let texto = null;
                try {
                    if (await postback(`Conteudo$${linha.i}`)) texto = await detalhe();
                } catch (erro) {
                    log.warning(`Detalhe falhou para ${nif}: ${erro.message}`);
                }
                empresas.set(nif, { data: linha.data, nif, entidade: linha.entidade, concelho: linha.concelho, acto: linha.acto, texto, cae: null });
            }
            lidas += pagina.length;
            log.info(`Detalhes: ${empresas.size} empresas`);
            if (lidas >= total || !(await postback('Page$Next'))) break;
        }
    }

    // A search without a results table and without the portal's "no results" text
    // usually means the CAPTCHA was rejected: retry once with a new CAPTCHA.
    async function pesquisarComRepeticao(distrito, concelho) {
        const nome = concelho ? `${distrito.nome}/${concelho.nome}` : distrito.nome;
        let resultado = await pesquisar(distrito, concelho);
        if (!resultado.temTabela && !resultado.semResultados) {
            log.warning(`${nome}: pesquisa sem resultados nem mensagem (${resultado.aviso || 'sem aviso'}); a repetir.`);
            resultado = await pesquisar(distrito, concelho);
            if (!resultado.temTabela && !resultado.semResultados) {
                log.warning(`${nome}: pesquisa falhou duas vezes (${resultado.aviso || 'sem aviso'}).`);
                avisos.push(`${nome} (falhou)`);
            }
        }
        log.info(`${nome}: ${resultado.total} publicações`);
        return resultado;
    }

    for (const [indice, distrito] of pedidos.entries()) {
        log.info(`Distrito ${indice + 1}/${pedidos.length}: ${distrito.nome}`);
        try {
            const { temTabela, total, concelhos } = await pesquisarComRepeticao(distrito);
            if (!temTabela || !total) continue;
            if (total < LIMITE_PORTAL || !concelhos.length) {
                if (total >= LIMITE_PORTAL) avisos.push(distrito.nome);
                await processar(total);
                continue;
            }
            log.info(`${distrito.nome}: mais de ${LIMITE_PORTAL} publicações, a pesquisar ${concelhos.length} concelhos.`);
            for (const [i, concelho] of concelhos.entries()) {
                log.info(`Distrito ${indice + 1}/${pedidos.length}: ${distrito.nome} (concelho ${i + 1}/${concelhos.length}: ${concelho.nome})`);
                try {
                    const parcial = await pesquisarComRepeticao(distrito, concelho);
                    if (!parcial.temTabela || !parcial.total) continue;
                    if (parcial.total >= LIMITE_PORTAL) avisos.push(`${distrito.nome}/${concelho.nome}`);
                    await processar(parcial.total);
                } catch (erro) {
                    log.warning(`Concelho ${concelho.nome} falhou: ${erro.message}`);
                }
            }
        } catch (erro) {
            log.warning(`Distrito ${distrito.nome} falhou: ${erro.message}`);
        }
    }

    // 5. CAE (SICAE)
    async function sicae(nipc) {
        const pagina = await fetch('http://www.sicae.pt/Consulta.aspx');
        const cookie = (pagina.headers.get('set-cookie') || '').split(';')[0];
        const html = await pagina.text();
        const campo = nome => (html.match(new RegExp(`name="${nome}"[^>]*value="([^"]*)"`)) || [])[1] || '';
        const corpo = new URLSearchParams({
            __VIEWSTATE: campo('__VIEWSTATE'), __VIEWSTATEGENERATOR: campo('__VIEWSTATEGENERATOR'), __EVENTVALIDATION: campo('__EVENTVALIDATION'),
            __EVENTTARGET: '', __EVENTARGUMENT: '', 'ctl00$MainContent$ipFirma': '', 'ctl00$MainContent$ipNipc': nipc,
            'ctl00$MainContent$ipCae': '', 'ctl00$MainContent$btnPesquisa': 'Pesquisar',
        });
        const resposta = await fetch('http://www.sicae.pt/Consulta.aspx', { method: 'POST', body: corpo, headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' } });
        const celulas = (await resposta.text()).replace(/<[^>]+>/g, '|').split('|').map(s => s.trim()).filter(Boolean);
        const pos = celulas.indexOf(nipc);
        if (pos < 0) return null;
        const codigos = [];
        for (const celula of celulas.slice(pos + 2)) {
            const encontrados = celula.match(/\b\d{5}\b/g);
            if (!encontrados) break;
            codigos.push(...encontrados);
        }
        return codigos.length ? { principal: codigos[0], secundarios: codigos.slice(1) } : null;
    }

    const lista = [...empresas.values()];
    log.info(`A obter CAE: ${lista.length} empresas`);
    for (let i = 0; i < lista.length; i += 4) {
        await Promise.all(lista.slice(i, i + 4).map(async empresa => {
            try { empresa.cae = await sicae(empresa.nif); } catch (erro) { log.warning(`SICAE falhou para ${empresa.nif}: ${erro.message}`); }
        }));
        log.info(`CAE: ${Math.min(i + 4, lista.length)}/${lista.length}`);
    }

    if (avisos.length) log.warning(`Limite de ${LIMITE_PORTAL} resultados atingido (podem faltar empresas): ${avisos.join(', ')}`);
    log.info(`Total encontrado: ${lista.length} empresas.`);
    return lista;
}
