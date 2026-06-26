const DRAWDOWN_LIMIT = 3; // 3 LOSS seguidos
const VETO_HOURS = 24; // Período de análise

async function verificarVetoDrawdown(db, par) {
    const limiteTempo = Date.now() - (VETO_HOURS * 60 * 60 * 1000);
    
    const snapshot = await db.collection("historico")
        .where("par", "==", par)
        .where("timestamp", ">=", limiteTempo)
        .orderBy("timestamp", "desc")
        .limit(DRAWDOWN_LIMIT)
        .get();

    if (snapshot.size < DRAWDOWN_LIMIT) return { vetado: false };

    const resultados = snapshot.docs.map(doc => doc.data().resultado);
    
    // Se todos os últimos resultados forem LOSS, ativa o veto
    const todosLoss = resultados.every(res => res === "LOSS");
    
    if (todosLoss) {
        return { 
            vetado: true, 
            motivo: `Sequência de ${DRAWDOWN_LIMIT} LOSS atingida nas últimas ${VETO_HOURS}h` 
        };
    }

    return { vetado: false };
}

module.exports = {
    verificarVetoDrawdown
};
