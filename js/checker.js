const admin = require("firebase-admin");
const { getCandles } = require("../scripts/marketData");
const fs = require('fs');
const path = require('path');

// Logs de ambiente para debug no GitHub Actions
console.log("Iniciando Result Checker...");

// Carregamento Seguro da Service Account
let serviceAccount;
const keyPath = path.join(__dirname, '../serviceAccount.json');

try {
    if (!fs.existsSync(keyPath)) {
        throw new Error(`Arquivo de credenciais não encontrado em: ${keyPath}`);
    }
    const rawData = fs.readFileSync(keyPath, 'utf8');
    if (!rawData || rawData.trim() === "") {
        throw new Error("O arquivo serviceAccount.json está vazio.");
    }
    serviceAccount = JSON.parse(rawData);
} catch (e) {
    console.error("ERRO CRÍTICO NA LEITURA DAS CREDENCIAIS:");
    console.error(e.message);
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// =====================================================
// CONFIGURAÇÕES
// =====================================================

const TEMPO_RESULTADO_MINUTOS = 15;
const PIPS_ALVO = 12.5; // Alvo de $5.00 com lote 0.04
const LOTE_PADRAO = 0.04;
const VALOR_POR_PIP = 0.40; // $0.40 por pip em lote 0.04

// =====================================================
// UTILITÁRIOS
// =====================================================

function calcularPips(par, entrada, fechamento) {
    const fator = par.includes("JPY") ? 100 : 10000;
    return Number(((fechamento - entrada) * fator).toFixed(1));
}

function calcularVariacaoPercentual(entrada, fechamento) {
    return Number((((fechamento - entrada) / entrada) * 100).toFixed(4));
}

async function buscarPrecoFechamento(par) {
    const candles = await getCandles(par);
    return Number(candles[candles.length - 1].close);
}

// =====================================================
// PROCESSAMENTO
// =====================================================

async function verificarSinais() {
    console.log("====================================");
    console.log("Forex Assist Result Checker");
    console.log("====================================");

    try {
        const snapshot = await db
            .collection("historico")
            .where("resultado", "==", "PENDENTE")
            .get();

        console.log(`Sinais Pendentes encontrados: ${snapshot.size}`);

        const agora = Date.now();

        for (const documento of snapshot.docs) {
            const sinal = documento.data();

            if (!sinal.timestamp || !sinal.precoEntrada || !sinal.par) {
                continue;
            }

            const entrada = typeof sinal.timestamp === "number"
                ? sinal.timestamp
                : sinal.timestamp.toDate().getTime();

            const minutos = (agora - entrada) / 60000;

            if (minutos < TEMPO_RESULTADO_MINUTOS) {
                continue;
            }

            try {
                const precoAtual = await buscarPrecoFechamento(sinal.par);
                const movimentoPips = calcularPips(sinal.par, sinal.precoEntrada, precoAtual);

                let resultado = "PENDENTE"; 

                if (sinal.direcao === "BUY" || sinal.direcao === "CALL") {
                    if (movimentoPips >= PIPS_ALVO) resultado = "WIN";
                    else if (movimentoPips <= -PIPS_ALVO) resultado = "LOSS";
                } else if (sinal.direcao === "SELL" || sinal.direcao === "PUT") {
                    if (movimentoPips <= -PIPS_ALVO) resultado = "WIN";
                    else if (movimentoPips >= PIPS_ALVO) resultado = "LOSS";
                }

                const multiplicadorDirecao = (sinal.direcao === "SELL" || sinal.direcao === "PUT") ? -1 : 1;
                const lucroEstimado = (movimentoPips * multiplicadorDirecao * VALOR_POR_PIP).toFixed(2);

                const variacaoPercentual = calcularVariacaoPercentual(sinal.precoEntrada, precoAtual);

                await documento.ref.update({
                    resultado,
                    precoFechamento: precoAtual,
                    horarioResultado: new Date().toLocaleTimeString("pt-BR"),
                    movimentoPips,
                    lucroEstimado: Number(lucroEstimado),
                    loteUtilizado: sinal.loteUtilizado || LOTE_PADRAO,
                    variacaoPercentual,
                    tempoDecorrido: Math.floor(minutos)
                });

                console.log(`${sinal.par} | Status: ${resultado} | Pips: ${movimentoPips} | Lucro: $${lucroEstimado}`);

            } catch (erro) {
                console.error(`Erro ao processar par ${sinal.par}:`, erro.message);
            }
        }
    } catch (erro) {
        console.error("Erro ao buscar sinais no Firestore:", erro.message);
    }

    console.log("====================================");
    console.log("Processamento Finalizado.");
    console.log("====================================");
}

verificarSinais();
