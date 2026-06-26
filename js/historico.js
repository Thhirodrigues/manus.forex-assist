function historicoView() {
  return `
    <div class="card">
      <div id="historicoHeader" style="position:sticky; top:0; z-index:999; background:#081733; padding-bottom:10px;">
        <div class="card-title">Histórico de Sinais</div>
        <div id="historicoStats" style="margin-bottom:15px;">Carregando estatísticas...</div>
      </div>
      <div id="historicoLista">Carregando histórico...</div>
    </div>
  `;
}

async function carregarHistorico() {
  const lista = document.getElementById("historicoLista");
  const stats = document.getElementById("historicoStats");
  if (!lista) return;

  try {
    const snapshot = await db
      .collection("historico")
      .orderBy("timestamp", "desc")
      .limit(300) // Aumentado para garantir sinais antigos
      .get();

    let wins = 0;
    let losses = 0;
    const gruposPorData = {};

    const hojeStr = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

    snapshot.forEach((doc) => {
      const sinal = doc.data();
      let dataObj = null;

      // 1. Tentar extrair data do timestamp (Firestore object, number ou string)
      if (sinal.timestamp) {
          let ts = sinal.timestamp;
          if (ts.toDate) ts = ts.toDate(); // Firestore Timestamp
          else if (typeof ts === "number" && ts < 1000000000000) ts = ts * 1000; // Segundos para ms
          
          const d = new Date(ts);
          if (!isNaN(d.getTime())) dataObj = d;
      }

      // 2. Fallback para campo 'horario' ou 'data'
      if (!dataObj && (sinal.horario || sinal.data)) {
          const str = sinal.horario || sinal.data;
          const partes = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (partes) {
              dataObj = new Date(partes[3], partes[2] - 1, partes[1]);
          }
      }

      if (sinal.resultado === "WIN") wins++;
      if (sinal.resultado === "LOSS") losses++;

      const dataSinal = dataObj 
          ? dataObj.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) 
          : "Data Indefinida";

      const isCooldown = sinal.status === "COOLDOWN" || sinal.origem === "cooldown";

      const isDestaque = app.sinalParaDestacar === doc.id;
      const card = `
        <div class="list-item" id="sinal-${doc.id}" style="${isDestaque ? 'border: 2px solid #00ff88; background: rgba(0, 255, 136, 0.1);' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:14px; font-weight:bold;">
            <span>
              ${isCooldown ? "🚫" : (sinal.direcao === "BUY" || sinal.direcao === "CALL" ? "🟢" : "🔴")}
              ${sinal.par || "-"}
              |
              ${(sinal.direcao || "-").replace("CALL", "COMPRA").replace("PUT", "VENDA")}
            </span>
            <span>
              ${isCooldown ? "COOLDOWN" : (sinal.resultado === "WIN" ? "✅ WIN" : sinal.resultado === "LOSS" ? "❌ LOSS" : "⏳ PENDENTE")}
            </span>
          </div>
          <div style="margin-top:4px; font-size:12px; color:#8c95b3;">
            ${dataSinal} &nbsp; 
            ${dataObj ? dataObj.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" }).substring(0, 5) : "--:--"}
            ${!isCooldown ? ` | Qualidade: ${sinal.qualidade ?? "-"}%` : ""}
          </div>
          ${sinal.movimentoPips !== undefined ? `
            <div style="margin-top:6px; font-size:12px; color:${sinal.resultado === 'WIN' ? '#00ff88' : '#ff4444'}; font-weight:bold;">
              Movimentação: ${sinal.movimentoPips > 0 ? '+' : ''}${sinal.movimentoPips} pips
            </div>
          ` : ''}
        </div>
      `;

      if (!gruposPorData[dataSinal]) gruposPorData[dataSinal] = "";
      gruposPorData[dataSinal] += card;
    });

    // Estatísticas
    const total = wins + losses;
    const taxa = total > 0 ? ((wins / total) * 100).toFixed(1) : "0";
    if (stats) {
      stats.innerHTML = `
        <div class="card" style="padding:10px;">
          <div style="text-align:center; font-size:17px; font-weight:bold;">
            ✅ ${wins} &nbsp;&nbsp;&nbsp; ❌ ${losses} &nbsp;&nbsp;&nbsp; 🎯 ${taxa}%
          </div>
          <button id="btnMinimizarTudo" style="margin-top:10px; width:100%; padding:8px; border:none; border-radius:8px; background:#132852; color:white; font-size:13px; cursor:pointer;">
            Minimizar Tudo
          </button>
        </div>
      `;
    }

    // Renderização dos Grupos
    let finalHtml = "";
    const datasOrdenadas = Object.keys(gruposPorData).sort((a, b) => {
      if (a === "Data Indefinida") return 1;
      if (b === "Data Indefinida") return -1;
      const [da, ma, aa] = a.split("/");
      const [db, mb, ab] = b.split("/");
      return new Date(ab, mb - 1, db) - new Date(aa, ma - 1, da);
    });

    datasOrdenadas.forEach((data) => {
      const idData = data.replaceAll("/", "");
      const isHoje = data === hojeStr;
      const label = isHoje ? `HOJE (${data})` : data;

      const temSinalDestacado = app.sinalParaDestacar && gruposPorData[data].includes(`id="sinal-${app.sinalParaDestacar}"`);
      const mostrarGrupo = isHoje || temSinalDestacado;

      finalHtml += `
        <div onclick="const el = document.getElementById('data${idData}'); el.style.display = el.style.display === 'none' ? 'block' : 'none';" 
             style="margin-top:20px; margin-bottom:10px; font-size:12px; color:#8c95b3; font-weight:bold; cursor:pointer; display:flex; align-items:center;">
          <span style="margin-right:8px;">${mostrarGrupo ? "▼" : "▶"}</span> ${label}
        </div>
        <div id="data${idData}" style="display: ${mostrarGrupo ? 'block' : 'none'};">
          ${gruposPorData[data]}
        </div>
      `;
    });

    lista.innerHTML = finalHtml || '<div class="list-item">Nenhum sinal encontrado.</div>';

    if (app.sinalParaDestacar) {
        const el = document.getElementById(`sinal-${app.sinalParaDestacar}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            app.sinalParaDestacar = null; // Limpa após destacar
        }
    }

    // Lógica do botão Minimizar Tudo
    document.getElementById("btnMinimizarTudo").onclick = () => {
      datasOrdenadas.forEach(data => {
          const idData = data.replaceAll("/", "");
          const el = document.getElementById(`data${idData}`);
          if (el) el.style.display = "none";
      });
    };

  } catch (erro) {
    console.error("Erro histórico:", erro);
    lista.innerHTML = `<div class="list-item">Erro ao carregar histórico: ${erro.message}</div>`;
  }
}
