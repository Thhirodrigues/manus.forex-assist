async function analisarPar({
    db,
    par,
    getCandles,
    ema,
    rsi,
    calcularQualidade,
    verificarCooldown,
    salvarOperacao
}) {

    try {

        if (await verificarCooldown(par))
            return;

        const candles =
            await getCandles(par);

        const closes =
            candles.map(c => Number(c.close));

        const ema9 =
            ema(9, closes.slice(-30));

        const ema21 =
            ema(21, closes.slice(-50));

        const rsiAtual =
            rsi(14, closes.slice(-15));

        const ema200 =
            ema(200, closes.slice(-250));

        let direcao = null;

        // Regra de Ouro: Tendência Macro (EMA 200)
        // Só compra se estiver ACIMA da 200. Só vende se estiver ABAIXO da 200.
        if (ema9 > ema21 && rsiAtual > 55 && closes[closes.length - 1] > ema200)
            direcao = "BUY";

        if (ema9 < ema21 && rsiAtual < 45 && closes[closes.length - 1] < ema200)
            direcao = "SELL";

if (!direcao)
    return;
        const qualidade =
    calcularQualidade(
        ema9,
        ema21,
        rsiAtual
    );

await salvarOperacao(db, {
    par,

    direcao,

    ema9,

    ema21,

    ema200,

    rsi: rsiAtual,

    qualidade,

    modo: "REAL",

    origem: "scanner",

    precoEntrada:
        closes[
            closes.length - 1
        ],

    loteUtilizado: 0.04,

    resultado: "PENDENTE"

});

console.log(
    `${par} ${direcao} OK`
);

    } catch (e) {
        console.log(`${par} erro`, e.message);
    }

}

module.exports = {
    analisarPar
};
