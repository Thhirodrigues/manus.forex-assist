const admin = require("firebase-admin");
const { getCandles } = require("../scripts/marketData");

console.log("KEY 1:", !!process.env.TWELVEDATA_KEY);
console.log("KEY 2:", !!process.env.TWELVEDATA_KEY_2);
console.log("KEY 3:", !!process.env.TWELVEDATA_KEY_3);

const serviceAccount = require("../serviceAccount.json");

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

    return Number(
        ((fechamento - entrada) * fator).toFixed(1)
    );

}

function calcularVariacaoPercentual(entrada, fechamento) {

    return Number(
        (
            ((fechamento - entrada) / entrada) * 100
        ).toFixed(4)
    );

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

    const snapshot = await db
        .collection("historico")
        .where("resultado", "==", "PENDENTE")
        .get();

    console.log(`Pendentes: ${snapshot.size}`);

    const agora = Date.now();

    for (const documento of snapshot.docs) {

        const sinal = documento.data();

        if (
            !sinal.timestamp ||
            !sinal.precoEntrada ||
            !sinal.par
        ) {
            continue;
        }

        const entrada =
    typeof sinal.timestamp === "number"
        ? sinal.timestamp
        : sinal.timestamp.toDate().getTime();

        const minutos =
            (agora - entrada) / 60000;

        if (minutos < TEMPO_RESULTADO_MINUTOS) {
            continue;
        }

        try {

            const precoAtual =
                await buscarPrecoFechamento(sinal.par);

            const movimentoPips =
                calcularPips(
                    sinal.par,
                    sinal.precoEntrada,
                    precoAtual
                );

            let resultado = "PENDENTE"; // Mantém pendente se não atingir alvos

            if (sinal.direcao === "BUY") {
                if (movimentoPips >= PIPS_ALVO) resultado = "WIN";
                else if (movimentoPips <= -PIPS_ALVO) resultado = "LOSS";
            } else if (sinal.direcao === "SELL") {
                // Para SELL, pips positivos significam queda de preço, então invertemos para o cálculo
                if (movimentoPips <= -PIPS_ALVO) resultado = "WIN";
                else if (movimentoPips >= PIPS_ALVO) resultado = "LOSS";
            }

            // Se ainda estiver pendente e o tempo expirou muito (ex: 2h), podemos forçar um resultado de mercado
            // Mas por enquanto, vamos seguir a regra dos pips fixos.
            
            const lucroEstimado = (movimentoPips * (sinal.direcao === "SELL" ? -1 : 1) * VALOR_POR_PIP).toFixed(2);

            const variacaoPercentual =
                calcularVariacaoPercentual(
                    sinal.precoEntrada,
                    precoAtual
                );

            await documento.ref.update({

                resultado,

                precoFechamento: precoAtual,

                horarioResultado:
                    new Date().toLocaleTimeString("pt-BR"),

                movimentoPips,

                lucroEstimado: Number(lucroEstimado),

                loteUtilizado: LOTE_PADRAO,

                variacaoPercentual,

                tempoDecorrido:
                    Math.floor(minutos)

            });

            console.log(
                `${sinal.par} | ${resultado} | ${movimentoPips} pips`
            );

        } catch (erro) {

            console.log(
                `Erro em ${sinal.par}: ${erro.message}`
            );

        }

    }

    console.log("Finalizado.");

}

verificarSinais();
