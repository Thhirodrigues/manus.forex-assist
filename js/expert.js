function dashboardView() {

    return `
    <div class="card">
        <div class="card-title">Scanner Status</div>
        <div id="scannerStatus" class="signal wait">
            Carregando...
        </div>
    </div>

    <div class="card">
        <div class="card-title">Modo Atual</div>
        <div class="big-number">Expert</div>
    </div>

    <div class="card">
        <div class="card-title">Sinais Hoje</div>
        <div id="sinaisHoje" class="big-number">0</div>
    </div>

    <div class="card">
        <div class="card-title">Cooldowns Hoje</div>
        <div id="cooldownsHoje" class="big-number">0</div>
    </div>

    <div class="card">
        <div class="card-title">Qualidade do Mercado</div>
        <div id="ultimaAnalise" class="signal wait">
            Aguardando análise...
        </div>
    </div>

    <div class="card">
        <div class="card-title">Último Sinal</div>
        <div id="ultimoSinal" class="signal wait" style="cursor:pointer;" onclick="app.irParaHistorico(this.dataset.id)">
            Nenhum sinal
        </div>
    </div>

    <div class="card">
        <div class="card-title">Quarentena Expert (Vetos)</div>
        <div id="expertQuarentena" style="font-size:12px; color:#ff4444; max-height:150px; overflow-y:auto;">
            Nenhum par bloqueado.
        </div>
    </div>

    <div class="card">
        <div class="card-title">Debug Firebase</div>
        <div id="debugFirebase">
            Iniciando...
        </div>
    </div>
    `;
}

setInterval(async () => {

    const status =
        document.getElementById(
            "scannerStatus"
        );

    if (!status) return;

    try {

        document.getElementById(
            "debugFirebase"
        ).innerHTML =
            "db encontrado";

        const doc =
            await window.db
                .collection("scanner")
                .doc("status")
                .get();

        const dados =
            doc.data() || {};

        document.getElementById(
            "debugFirebase"
        ).innerHTML =
            "Firestore conectado";

        status.innerHTML =
            dados.ativo
                ? "🟢 Online"
                : "🔴 Parado";

        document.getElementById(
            "sinaisHoje"
        ).innerHTML =
            dados.sinaisHoje || 0;

        document.getElementById(
            "cooldownsHoje"
        ).innerHTML =
            dados.cooldownsHoje || 0;

        let ultimaAnalise =
    dados.ultimaAnalise ||
    "Aguardando análise";

ultimaAnalise =
    ultimaAnalise
      .replaceAll("CALL", "🟢 COMPRA")
      .replaceAll("PUT", "🔴 VENDA");

document.getElementById(
    "ultimoSinal"
).innerHTML =
    ultimoSinal;

        // Exibir pares em quarentena
        const quarentenaEl = document.getElementById("expertQuarentena");
        let vetosHtml = "";
        Object.keys(dados).forEach(key => {
            if (key.startsWith("veto_")) {
                const par = key.replace("veto_", "").replace("_", "/");
                vetosHtml += `<div style="margin-bottom:5px;">🚫 <b>${par}</b>: ${dados[key]}</div>`;
            }
        });
        quarentenaEl.innerHTML = vetosHtml || "Nenhum par bloqueado.";

let ultimoSinal =
    dados.ultimoSinal ||
    "Nenhum sinal";

ultimoSinal =
    ultimoSinal
      .replaceAll("CALL", "🟢 COMPRA")
      .replaceAll("PUT", "🔴 VENDA");

        const ultimoSinalEl = document.getElementById("ultimoSinal");
        ultimoSinalEl.innerHTML = ultimoSinal;
        if (dados.ultimoSinalId) {
            ultimoSinalEl.dataset.id = dados.ultimoSinalId;
        }

    } catch (erro) {

        document.getElementById(
            "debugFirebase"
        ).innerHTML =
            erro.message;

    }

}, 2000);
