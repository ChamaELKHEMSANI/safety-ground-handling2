let state = {
  pistes: [],          
  selected: new Set(), 
  excluded: new Set(), 
  filtered: [],        
  currentIndex: -1,    
  currentRating: 0,    
  filterText: '',
  filterPriority: '',
  filterCategory: '',
  filterRating: 0,
  filterRelation: '',
  lastSaved: null,
  selectionMode: 'all' 
};
const JSON_DAT = {
  "pistes": [
    {
      "numero": "1",
      "titre": "Permis à points",
      "slogan": "RESPONSABILISER L'INDIVIDU, PAS SEULEMENT LE COLLECTIF",
      "description_details": "Le système de permis à points est un dispositif de responsabilisation individuelle des conducteurs d'engins de piste...",
      "priorite": "Quick Win",
      "categorie": "Culture",
      "image": "img/P1.png",
      "rating": 0,
      "annotation": "",
      "faisabilite": "",
      "cout": "",
      "delai": 6,
      "impact": "",
      "remarques": "",
      "justificatifs": [
        {
          "societe": "Aéroports de Montréal",
          "url": "https://www.admtl.com/en/about-airport/airport-operations/airside-driving-permit",
          "description": "Système de permis de conduire côté piste avec 3 types de permis obligatoires"
        },
        {
          "societe": "ACI Africa",
          "url": "https://acifrica.org/safety-security/airside-safety/",
          "description": "Standards internationaux pour la sécurité airside"
        }
      ]
    }
  ]
};
async function loadExternalJSON() {
  try {
    const response = await fetch('json/pistes-all-30.json');
    if (!response.ok) throw new Error('Fichier pistes.json non trouvé');
    const data = await response.json();
    loadJSON(data);
  } catch (error) {
    console.error('Erreur chargement JSON:', error);
    showToast('Erreur : impossible de charger pistes.json', 'error');
    loadJSON(JSON_DAT);
  }
}
async function loadJSON(data) {
  try {
    if (!data.pistes || !Array.isArray(data.pistes)) throw new Error('Format JSON invalide');
    state.pistes = data.pistes.map(p => ({ ...p }));
    showToast(`${data.pistes.length} pistes chargées `, 'success');
    initSelection();
  } catch (error) {
    console.error('Erreur chargement JSON:', error);
    showToast('Erreur : impossible de charger pistes.json', 'error');
    state.pistes = [];
    initSelection();
  }
    initEditionTabLayout();
    if (state.filtered.length > 0) {
      selectTrack(0);
    }
    initScoresChart();  
    applyFilters();
    syncSimulationMaxPistes();
    updateProgress();
    initNewCharts();
    initDecisionMatrixModal();
    initSimulation();
    initRelationsMatrixModal();
    initPisteTabs();
    initSelectionModal(); 
}
let scoresChart = null;
let isDragging = false;
let dragIndex = -1; 
function initScoresChart() {
  const ctx = document.getElementById('scores-chart').getContext('2d');
  if (scoresChart) {
    scoresChart.destroy();
  }
  if (state.filtered.length === 0) {
    ctx.canvas.style.display = 'none';
    let messageEl = document.getElementById('chart-empty-message');
    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.id = 'chart-empty-message';
      messageEl.className = 'chart-empty-message';
      messageEl.textContent = 'Aucune piste ne correspond aux filtres sélectionnés';
      ctx.canvas.parentNode.appendChild(messageEl);
    }
    return;
  }
  ctx.canvas.style.display = 'block';
  const messageEl = document.getElementById('chart-empty-message');
  if (messageEl) messageEl.remove();
  const filteredPistes = state.filtered;
  const labels = filteredPistes.map(p => p.numero);
  const scores = filteredPistes.map(p => p.rating || 0);
  const pointColors = filteredPistes.map(p => {
    switch(p.priorite) {
      case 'Quick Win': return '#059669'; 
      case 'Stratégique': return '#d97706'; 
      case 'Complémentaire': return '#2563eb'; 
      case 'Long Terme': return '#7c3aed'; 
      default: return '#9ca3af'; 
    }
  });
scoresChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: labels,
    datasets: [{
      label: 'Score (0-5)',
      data: scores,
      borderColor: '#1a56db',
      backgroundColor: 'rgba(26, 86, 219, 0.1)',
      borderWidth: 2,
      pointBackgroundColor: pointColors,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointRadius: 8,
      pointHoverRadius: 8,  
      pointHitRadius: 15,
      tension: 0.1,
      fill: true,
      pointStyle: 'circle'
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0
    },
    hover: {
      animationDuration: 0,
      mode: 'nearest',
      intersect: true
    },
    plugins: {
      tooltip: {
        enabled: true,
        callbacks: {
          title: function(context) {
            const index = context[0].dataIndex;
            const piste = filteredPistes[index];
            return `Piste ${piste.numero} : ${piste.titre}`;
          },
          label: function(context) {
            const index = context.dataIndex;
            const piste = filteredPistes[index];
            const score = context.raw;
            return [
              `Score : ${score} / 5`,
              `Priorité : ${piste.priorite}`,
              `Catégorie : ${piste.categorie}`
            ];
          }
        },
        backgroundColor: '#1f2937',
        titleColor: '#ffffff',
        bodyColor: '#e5e7eb',
        borderColor: '#374151',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: false
      },
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 5,
        min: 0,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        title: {
          display: true,
          text: 'Score / 5'
        }
      },
      x: {
        grid: {
          display: false
        },
        title: {
          display: true,
          text: 'Numéro de piste'
        }
      }
    },
    onClick: function(event, elements) {
      if (elements && elements.length > 0 && !isDragging) {
        const filteredIndex = elements[0].index;
        selectTrack(filteredIndex);
      }
    }
  }
});
  makeChartDraggable();
}
function makeChartDraggable() {
  const canvas = document.getElementById('scores-chart');
  canvas.addEventListener('mousemove', (e) => {
    if (!scoresChart) return;
    const rect = canvas.getBoundingClientRect();
    const elements = scoresChart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
    if (elements.length > 0) {
      canvas.style.cursor = 'grab';
      dragIndex = elements[0].dataIndex; 
    } else {
      canvas.style.cursor = 'default';
      if (!isDragging) dragIndex = -1;
    }
  });
  canvas.addEventListener('mousedown', (e) => {
    if (dragIndex === -1) return;
    isDragging = true;
    canvas.style.cursor = 'grabbing';
    const filteredPistes = state.filtered;
    const currentPiste = filteredPistes[dragIndex];
    if (currentPiste) {
      showToast(`Modification du score de la piste ${currentPiste.numero}`, 'info');
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging || dragIndex === -1 || !scoresChart) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const chartArea = scoresChart.chartArea;
    if (!chartArea) return;
    const yMin = chartArea.top;
    const yMax = chartArea.bottom;
    let newScore = 5 - ((Math.min(Math.max(y, yMin), yMax) - yMin) / (yMax - yMin)) * 5;
    newScore = Math.round(newScore ) ;
    newScore = Math.min(5, Math.max(0, newScore));
    const filteredPistes = state.filtered;
    const pisteFiltree = filteredPistes[dragIndex];
    const masterPiste = state.pistes.find(p => p.numero === pisteFiltree.numero);
    if (masterPiste) {
      masterPiste.rating = newScore;
      pisteFiltree.rating = newScore; 
      scoresChart.data.datasets[0].data[dragIndex] = newScore;
      scoresChart.update();
      const currentFilteredIndex = state.currentIndex >= 0 ? state.currentIndex : -1;
      if (currentFilteredIndex === dragIndex) {
        state.currentRating = newScore;
        renderStars(newScore);
      }
      updateSelectOptionForPiste(pisteFiltree);
    }
  });
  document.addEventListener('mouseup', () => {
    if (isDragging && dragIndex !== -1) {
      isDragging = false;
      canvas.style.cursor = 'grab';
      const filteredPistes = state.filtered;
      const piste = filteredPistes[dragIndex];
      if (piste) {
        showToast(`Score de la piste ${piste.numero} mis à jour : ${piste.rating}★`, 'success');
        updateProgress();
      }
      dragIndex = -1;
    }
  });
  canvas.addEventListener('mouseleave', () => {
    if (isDragging) {
      isDragging = false;
      canvas.style.cursor = 'default';
      dragIndex = -1;
    }
  });
}
function makeChartDraggable() {
  const canvas = document.getElementById('scores-chart');
  canvas.addEventListener('mousemove', (e) => {
    if (!scoresChart) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const elements = scoresChart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
    if (elements.length > 0) {
      canvas.style.cursor = 'grab';
      dragIndex = elements[0].index;
    } else {
      canvas.style.cursor = 'default';
      if (!isDragging) dragIndex = -1;
    }
  });
  canvas.addEventListener('mousedown', (e) => {
    if (dragIndex === -1) return;
    isDragging = true;
    canvas.style.cursor = 'grabbing';
    const currentPiste = state.pistes[dragIndex];
    if (currentPiste) {
      showToast(`Modification du score de la piste ${currentPiste.numero}`, 'info');
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging || dragIndex === -1 || !scoresChart) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const chartArea = scoresChart.chartArea;
    if (!chartArea) return;
    const yMin = chartArea.top;
    const yMax = chartArea.bottom;
    let newScore = 5 - ((Math.min(Math.max(y, yMin), yMax) - yMin) / (yMax - yMin)) * 5;
    newScore = Math.round(newScore ) ; 
    newScore = Math.min(5, Math.max(0, newScore));
    if (state.pistes[dragIndex]) {
      state.pistes[dragIndex].rating = newScore;
      scoresChart.data.datasets[0].data[dragIndex] = newScore;
      scoresChart.update();
      const currentFilteredIndex = state.currentIndex >= 0 ? state.filtered[state.currentIndex]?.numero : null;
      if (currentFilteredIndex === state.pistes[dragIndex].numero) {
        state.currentRating = newScore;
        renderStars(newScore);
      }
      updateSelectOptionForPiste(state.pistes[dragIndex]);
    }
  });
  document.addEventListener('mouseup', () => {
    if (isDragging && dragIndex !== -1) {
      isDragging = false;
      canvas.style.cursor = 'grab';
      const piste = state.pistes[dragIndex];
      if (piste) {
        showToast(`Score de la piste ${piste.numero} mis à jour : ${piste.rating}★`, 'success');
        updateProgress();
      }
      dragIndex = -1;
    }
  });
  canvas.addEventListener('mouseleave', () => {
    if (isDragging) {
      isDragging = false;
      canvas.style.cursor = 'default';
      dragIndex = -1;
    }
  });
}
function updateSelectOptionForPiste(piste) {
  const filteredIndex = state.filtered.findIndex(p => p.numero === piste.numero);
  if (filteredIndex >= 0) {
    const sel = document.getElementById('track-select');
    const opt = sel.options[filteredIndex];
    if (opt) {
      const rated = piste.rating > 0 ? ` ★${piste.rating}` : '';
      opt.textContent = `${piste.numero} - ${piste.titre}${rated}`;
    }
  }
}
function updateScoresChart() {
  if (scoresChart) {
    scoresChart.data.datasets[0].data = state.pistes.map(p => p.rating || 0);
    scoresChart.data.datasets[0].pointBackgroundColor = state.pistes.map(p => 
      p.rating > 0 ? '#1a56db' : '#9ca3af'
    );
    scoresChart.update();
  }
}
let histogramChart = null;
let bubbleChart = null; 
let radarChart = null;
let triangleChart = null;
let chartTabsInitialized = false;
function stabilizeChartCanvas(canvas, height = 220) {
  if (!canvas) return;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = `${height}px`;
}
function initNewCharts() {
  initHistogramChart();
  initBubbleChart();
  initRadarChart();
  initTriangleChart();
  setupChartTabs();
}
function initHistogramChart() {
  const canvas = document.getElementById('histogram-chart');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  stabilizeChartCanvas(canvas, 240);
  if (histogramChart) histogramChart.destroy();
  const filteredPistes = state.filtered;
  if (filteredPistes.length === 0) return;
  const labels = filteredPistes.map(p => `P${p.numero}`);
  const maxCout = Math.max(...filteredPistes.map(p => (p.cout_3_ans || 0) / 1000000));
  const maxDelai = Math.max(...filteredPistes.map(p => p.delai_mois || 6));
  const maxImpact = 5; 
  const coutData = filteredPistes.map(p => ((p.cout_3_ans || 0) / 1000000) / (maxCout || 1) * 5);
  const delaiData = filteredPistes.map(p => (p.delai_mois || 6) / (maxDelai || 30) * 5);
  const impactData = filteredPistes.map(p => p.niveau_impact || 0);
  histogramChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Coût (normalisé)',
          data: coutData,
          backgroundColor: 'rgba(26, 86, 219, 0.7)',
          borderColor: '#1a56db',
          borderWidth: 1,
          hoverBackgroundColor: 'rgba(26, 86, 219, 0.9)', 
          hoverBorderColor: '#1a56db',
          hoverBorderWidth: 1
        },
        {
          label: 'Délai (normalisé)',
          data: delaiData,
          backgroundColor: 'rgba(5, 150, 105, 0.7)',
          borderColor: '#059669',
          borderWidth: 1,
          hoverBackgroundColor: 'rgba(5, 150, 105, 0.9)',
          hoverBorderColor: '#059669',
          hoverBorderWidth: 1
        },
        {
          label: 'Impact (/5)',
          data: impactData,
          backgroundColor: 'rgba(217, 119, 6, 0.7)',
          borderColor: '#d97706',
          borderWidth: 1,
          hoverBackgroundColor: 'rgba(217, 119, 6, 0.9)',
          hoverBorderColor: '#d97706',
          hoverBorderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context) {
              const index = context.dataIndex;
              const piste = filteredPistes[index];
              const value = context.raw;
              if (context.dataset.label === 'Coût (normalisé)') {
                const coutReel = (piste.cout_3_ans || 0) / 1000000;
                return `Coût: ${coutReel.toFixed(2)} M€ (norm: ${value.toFixed(2)})`;
              } else if (context.dataset.label === 'Délai (normalisé)') {
                return `Délai: ${piste.delai_mois || 6} mois (norm: ${value.toFixed(2)})`;
              } else {
                return `Impact: ${value}/5`;
              }
            }
          },
          backgroundColor: '#1f2937',
          titleColor: '#ffffff',
          bodyColor: '#e5e7eb'
        },
        legend: {
          position: 'top',
          labels: { 
            font: { size: 10 },
            usePointStyle: true,
            pointStyle: 'rect'
          }
        },
        datalabels: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 5,
          title: { display: true, text: 'Valeur normalisée /5' },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      },
      animation: {
        duration: 0 
      },
      hover: {
        animationDuration: 0, 
        mode: 'nearest',
        intersect: true,
        axis: 'x'
      },
      elements: {
        bar: {
          hoverBackgroundColor: undefined, 
        }
      }
    }
  });
}
function initBubbleChart() {
  const canvas = document.getElementById('bubble-chart');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  if (canvas) {
    canvas.style.width = '100%';
    canvas.style.height = '240px';
    canvas.width = canvas.offsetWidth || 400;
    canvas.height = 240;
  }
  if (bubbleChart) bubbleChart.destroy();
  const pistes = state.filtered;
  if (pistes.length === 0) return;
  const datasets = [
    { 
      label: 'Quick Win', 
      data: [], 
      backgroundColor: 'rgba(5, 150, 105, 0.7)', 
      borderColor: '#059669',
      hoverBackgroundColor: 'rgba(5, 150, 105, 0.9)'
    },
    { 
      label: 'Stratégique', 
      data: [], 
      backgroundColor: 'rgba(217, 119, 6, 0.7)', 
      borderColor: '#d97706',
      hoverBackgroundColor: 'rgba(217, 119, 6, 0.9)'
    },
    { 
      label: 'Complémentaire', 
      data: [], 
      backgroundColor: 'rgba(37, 99, 235, 0.7)', 
      borderColor: '#2563eb',
      hoverBackgroundColor: 'rgba(37, 99, 235, 0.9)'
    },
    { 
      label: 'Long Terme', 
      data: [], 
      backgroundColor: 'rgba(124, 58, 237, 0.7)', 
      borderColor: '#7c3aed',
      hoverBackgroundColor: 'rgba(124, 58, 237, 0.9)'
    },
    { 
      label: 'Autres', 
      data: [], 
      backgroundColor: 'rgba(156, 163, 175, 0.7)', 
      borderColor: '#9ca3af',
      hoverBackgroundColor: 'rgba(156, 163, 175, 0.9)'
    }
  ];
  const impacts = pistes.map(p => p.niveau_impact || 0);
  const minImpact = Math.min(...impacts);
  const maxImpact = Math.max(...impacts, 1);
  pistes.forEach(p => {
    const cout = (p.cout_3_ans || 0) / 1000000; 
    const delai = p.delai_mois || 6;
    const impact = p.niveau_impact || 0;
    const r = maxImpact > minImpact 
      ? 5 + (impact - minImpact) / (maxImpact - minImpact) * 20
      : 15; 
    const point = {
      x: delai,
      y: cout,
      r: Math.max(5, Math.min(25, r)), 
      impact: impact,
      numero: p.numero,
      titre: p.titre,
      priorite: p.priorite,
      categorie: p.categorie,
      coutReel: cout,
      delaiReel: delai
    };
    switch(p.priorite) {
      case 'Quick Win': datasets[0].data.push(point); break;
      case 'Stratégique': datasets[1].data.push(point); break;
      case 'Complémentaire': datasets[2].data.push(point); break;
      case 'Long Terme': datasets[3].data.push(point); break;
      default: datasets[4].data.push(point);
    }
  });
  const activeDatasets = datasets.filter(d => d.data.length > 0);
  bubbleChart = new Chart(ctx, {
    type: 'bubble',
    data: { datasets: activeDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      hover: { 
        animationDuration: 0,
        mode: 'point'
      },
      elements: {
        point: {
          hoverBorderWidth: 2,
          hoverBorderColor: '#ffffff'
        }
      },
      plugins: {
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context) {
              const point = context.raw;
              return [
                `Piste ${point.numero}: ${point.titre}`,
                `Coût: ${point.coutReel.toFixed(2)} M€`,
                `Délai: ${point.delaiReel} mois`,
                `Impact: ${point.impact}/5`,
                `Priorité: ${point.priorite}`,
                `Catégorie: ${point.categorie}`
              ];
            }
          },
          backgroundColor: '#1f2937',
          titleColor: '#ffffff',
          bodyColor: '#e5e7eb',
          padding: 10,
          cornerRadius: 8
        },
        legend: { 
          position: 'top', 
          labels: { 
            font: { size: 10 },
            usePointStyle: true,
            pointStyle: 'circle'
          } 
        }
      },
      scales: {
        x: {
          title: { 
            display: true, 
            text: 'Délai (mois)',
            font: { weight: '600', size: 11 }
          },
          beginAtZero: true,
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        },
        y: {
          title: { 
            display: true, 
            text: 'Coût (M€)',
            font: { weight: '600', size: 11 }
          },
          beginAtZero: true,
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        }
      },
      onClick: function(event, elements) {
        if (elements && elements.length > 0) {
          const element = elements[0];
          const datasetIndex = element.datasetIndex;
          const index = element.index;
          const dataset = this.data.datasets[datasetIndex];
          if (dataset && dataset.data[index]) {
            const point = dataset.data[index];
            const filteredIndex = state.filtered.findIndex(p => p.numero === point.numero);
            if (filteredIndex >= 0) {
              selectTrack(filteredIndex);
            }
          }
        }
      }
    }
  });
}
function initRadarChart() {
  const canvas = document.getElementById('radar-chart');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  stabilizeChartCanvas(canvas, 260);
  if (radarChart) radarChart.destroy();
  radarChart = null;
  const pisteCourante = state.currentIndex >= 0 ? state.filtered[state.currentIndex] : state.filtered[0];
  if (pisteCourante) {
    updateRadarForSelectedPiste(pisteCourante);
  } else {
    radarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Coût', 'Délai', 'Impact', 'Faisabilité', 'Acceptabilité', 'Score'],
        datasets: [{
          label: 'Aucune piste sélectionnée',
          data: [0, 0, 0, 0, 0, 0],
          backgroundColor: 'rgba(26, 86, 219, 0.2)',
          borderColor: '#1a56db',
          pointBackgroundColor: '#1a56db'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { r: { min: 0, max: 5, beginAtZero: true } },
        plugins: { legend: { display: false } }
      }
    });
  }
}
function updateRadarForSelectedPiste(piste) {
  if (!piste) {
    piste = state.currentIndex >= 0 ? state.filtered[state.currentIndex] : state.filtered[0];
  }
  if (!piste) return;
  const ctx = document.getElementById('radar-chart')?.getContext('2d');
  if (!ctx) return;
  const maxCout = Math.max(...state.pistes.map(p => (p.cout_3_ans || 0) / 1000000));
  const maxDelai = Math.max(...state.pistes.map(p => p.delai_mois || 6));
  const coutNorm = maxCout > 0 ? ((piste.cout_3_ans || 0) / 1000000) / maxCout * 5 : 0;
  const delaiNorm = maxDelai > 0 ? (piste.delai_mois || 6) / maxDelai * 5 : 0;
  const impact = piste.niveau_impact || 0;
  const faisabilite = piste.niveau_faisabilite || 0;
  const acceptabilite = piste.niveau_acceptabilite || 0;
  const score = piste.rating || 0;
  const data = [coutNorm, delaiNorm, impact, faisabilite, acceptabilite, score];
  if (radarChart) {
    radarChart.data.datasets[0].data = data;
    radarChart.data.datasets[0].label = `Piste ${piste.numero} - ${piste.titre}`;
    radarChart.update();
  } else {
    radarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Coût', 'Délai', 'Impact', 'Faisabilité', 'Acceptabilité', 'Score'],
        datasets: [{
          label: `Piste ${piste.numero} - ${piste.titre}`,
          data: data,
          backgroundColor: 'rgba(26, 86, 219, 0.2)',
          borderColor: '#1a56db',
          pointBackgroundColor: '#1a56db',
          pointHoverBackgroundColor: '#1a56db',
          pointHoverBorderColor: '#ffffff',
          pointHoverRadius: 4, 
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        hover: { animationDuration: 0 },
        scales: { 
          r: { 
            min: 0, 
            max: 5, 
            beginAtZero: true,
            grid: { color: 'rgba(0, 0, 0, 0.05)' }
          } 
        },
        plugins: {
          tooltip: {
            enabled: true,
            callbacks: {
              label: function(context) {
                const labels = ['Coût', 'Délai', 'Impact', 'Faisabilité', 'Acceptabilité', 'Score'];
                const values = [
                  `${(piste.cout_3_ans || 0).toLocaleString()} €`,
                  `${piste.delai_mois || 6} mois`,
                  `${impact}/5`,
                  `${faisabilite}/5`,
                  `${acceptabilite}/5`,
                  `${score}/5`
                ];
                return `${labels[context.dataIndex]}: ${values[context.dataIndex]}`;
              }
            },
            backgroundColor: '#1f2937'
          },
          legend: { display: false }
        }
      }
    });
  }
}
function applyFilters() {
  const txt = state.filterText.toLowerCase();
  const pri = state.filterPriority;
  const cat = state.filterCategory;
  const rat = state.filterRating;
  state.filtered = state.pistes.filter(p => {
    if (txt && !p.titre.toLowerCase().includes(txt)) return false;
    if (pri && p.priorite !== pri) return false;
    if (cat && p.categorie !== cat) return false;
    if (rat > 0) {
      if (rat === 5 && p.rating !== 5) return false;
      if (rat < 5 && p.rating < rat) return false;
    }
    return true;
  });
  const sel = document.getElementById('track-select');
  const prevPisteId = state.currentIndex >= 0 && state.filtered[state.currentIndex]
    ? state.filtered[state.currentIndex].numero : null;
  sel.innerHTML = '';
  if (state.filtered.length === 0) {
    sel.innerHTML = '<option value="">Aucune piste trouvée</option>';
    document.getElementById('card-num').textContent = 'PISTE #-';
    document.getElementById('card-title').textContent = 'Sélectionner une piste';
    document.getElementById('card-slogan').textContent = '-';
    document.getElementById('card-desc').textContent = 'Les détails de la piste apparaîtront ici après sélection.';
    document.getElementById('card-short-desc').style.display = 'none';
    document.getElementById('conviction-container').style.display = 'none';
    document.getElementById('rex-container').style.display = 'none';
    document.getElementById('justificatifs-container').style.display = 'none';
    document.getElementById('summary-container').style.display = 'none';
    document.getElementById('propositions-container').style.display = 'none';
    document.getElementById('card-categorie').textContent = '-';
    document.getElementById('card-priorite').textContent = '-';
    state.currentIndex = -1;
  } else {
    state.filtered.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      const rated = p.rating > 0 ? ` ★${p.rating}` : '';
      opt.textContent = `${p.numero} - ${p.titre}${rated}`;
      sel.appendChild(opt);
    });
    let newIdx = 0;
    if (prevPisteId) {
      const found = state.filtered.findIndex(p => p.numero === prevPisteId);
      if (found >= 0) newIdx = found;
    }
    state.currentIndex = newIdx;
    sel.value = newIdx;
    loadCurrentTrack();
  }
  document.getElementById('filter-count').textContent = 
    `${state.filtered.length} piste${state.filtered.length !== 1 ? 's' : ''}`;
  initScoresChart();
  initHistogramChart();
  initBubbleChart(); 
  initTriangleChart();
  updateProgress();
  if (state.filterRelation === 'has' && (!p.relations || p.relations.length === 0)) return false;
document.querySelectorAll('#relation-pills .pill').forEach(pill => {
  pill.addEventListener('click', () => {
    state.filterRelation = pill.dataset.relation;
    document.querySelectorAll('#relation-pills .pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    applyFilters();
  });
});
if (histogramChart) {
  initHistogramChart(); 
}
if (bubbleChart) {
  initBubbleChart(); 
}
if (radarChart) {
  updateRadarForSelectedPiste();
}
if (document.getElementById('synthese-modal').style.display === 'block') {
  updateSyntheseDisplay();
}
if (document.getElementById('decision-matrix-modal').style.display === 'block') {
  buildDecisionMatrix();
}
if (document.getElementById('relations-matrix-modal').style.display === 'block') {
  refreshMatrix();
}
refreshRelationsTab()
}
function formatNumber(num) {
  if (num === undefined || num === null || num === '') return '-';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function renderStarsFromValue(value, elementId) {
  const starsContainer = document.getElementById(elementId);
  if (!starsContainer) return;
  const val = parseInt(value) || 0;
  let starsHtml = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= val) {
      starsHtml += '<i class="fa-solid fa-star" style="color: var(--c-star);"></i>';
    } else {
      starsHtml += '<i class="fa-regular fa-star" style="color: var(--c-star-empty);"></i>';
    }
  }
  starsContainer.innerHTML = starsHtml;
}
function selectTrack(filteredIdx) {
  state.currentIndex = filteredIdx;
  const sel = document.getElementById('track-select');
  sel.value = filteredIdx;
  loadCurrentTrack();
}
function loadCurrentTrack() {
  if (state.currentIndex < 0 || state.currentIndex >= state.filtered.length) return;
  const piste = state.filtered[state.currentIndex];
  document.getElementById('notation-piste-id').textContent = `PISTE #${piste.numero}`;
  document.getElementById('card-num').textContent = `PISTE #${piste.numero}`;
  document.getElementById('card-title').textContent = piste.titre;
  document.getElementById('card-slogan').textContent = `${piste.slogan}`;
  const shortDescElement = document.getElementById('card-short-desc');
  if (piste.description) {
    shortDescElement.textContent = piste.description;
    shortDescElement.style.display = 'block';
  } else {
    shortDescElement.style.display = 'none';
  }
  document.getElementById('card-categorie').textContent = piste.categorie;
  document.getElementById('card-priorite').textContent = piste.priorite;
  const activePistes = getActivePistes();
  const isActive = activePistes.some(p => p.numero === piste.numero);
  if (!isActive) {
    if (activePistes.length > 0) {
      const newIndex = state.filtered.findIndex(p => p.numero === activePistes[0].numero);
      if (newIndex >= 0) {
        selectTrack(newIndex);
        return;
      }
    }
  }
  displayRelations(piste);
  document.getElementById('track-select').value = state.currentIndex;
  if (currentPisteTab === 'image') {
    updatePisteImage(piste);
  } else if (currentPisteTab === 'edition') {
    updateEditionTab(piste);
  } else if (currentPisteTab === 'synthese') {
    updatePisteSynthese(piste);
  } else if (currentPisteTab === 'details') {
    updatePisteDetails(piste);
  } else if (currentPisteTab === 'references') {
    updatePisteReferences(piste);
  }else if (currentPisteTab === 'risques') {
    updatePisteRisques(piste);
  } else if (currentPisteTab === 'relations') {
  } else if (currentPisteTab === 'radar') {
    initRadarChart();
  }
  updateDetailModalTitle();
}
function updateEditionTab(piste) {
  if (!piste) return;
  state.currentRating = parseInt(piste.rating, 10) || 0;
  renderStars(state.currentRating);
  const annotationField = document.getElementById('annotation-field');
  const remarquesField = document.getElementById('q-remarques');
  const cout2026Field = document.getElementById('q-cout-2026');
  const cout2027Field = document.getElementById('q-cout-2027');
  const cout2028Field = document.getElementById('q-cout-2028');
  const coutRecurrentField = document.getElementById('q-cout-recurrent');
  const delaiField = document.getElementById('q-delai-json-range');
  const impactField = document.getElementById('q-impact-level-input');
  const faisabiliteField = document.getElementById('q-faisabilite-level-input');
  const acceptabiliteField = document.getElementById('q-acceptabilite-level-input');
  if (annotationField) annotationField.value = piste.annotation || '';
  if (remarquesField) remarquesField.value = piste.remarques || '';
  if (cout2026Field) cout2026Field.value = piste.cout_2026 || '';
  if (cout2027Field) cout2027Field.value = piste.cout_2027 || '';
  if (cout2028Field) cout2028Field.value = piste.cout_2028 || '';
  if (coutRecurrentField) coutRecurrentField.value = piste.cout_recurrent_annuel || '';
  if (delaiField) {
    delaiField.value = piste.delai_mois || 6;
    updateDelaiRange(delaiField.value);
  }
  if (impactField) impactField.value = piste.niveau_impact || '';
  if (faisabiliteField) faisabiliteField.value = piste.niveau_faisabilite || '';
  if (acceptabiliteField) acceptabiliteField.value = piste.niveau_acceptabilite || '';
  updateInputStars('q-impact-level-input', 'impact-stars');
  updateInputStars('q-faisabilite-level-input', 'faisabilite-stars');
  updateInputStars('q-acceptabilite-level-input', 'acceptabilite-stars');
  updateTotalCout();
  initScoresChart();
  initHistogramChart();
  initBubbleChart();
  updateProgress();
}
function renderStars(rating) {
  const btns = document.querySelectorAll('.star-btn');
  btns.forEach((btn, i) => {
    if (i < rating) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  document.getElementById('score-display').innerHTML =
    rating > 0 ? `${rating} <span>/ 5</span>` : `- <span>/ 5</span>`;
}
function saveCurrentTrack() {
  if (state.currentIndex < 0 || state.currentIndex >= state.filtered.length) {
    showToast('Aucune piste sélectionnée.', 'warn');
    return false;
  }
  const piste = state.filtered[state.currentIndex];
  const master = state.pistes.find(p => p.numero === piste.numero);
  if (!master) return false;
  const data = {
    rating: state.currentRating,
    annotation: document.getElementById('annotation-field').value,
    remarques: document.getElementById('q-remarques').value,
    cout_2026: parseFloat(document.getElementById('q-cout-2026').value) || 0,
    cout_2027: parseFloat(document.getElementById('q-cout-2027').value) || 0,
    cout_2028: parseFloat(document.getElementById('q-cout-2028').value) || 0,
    cout_recurrent_annuel: parseFloat(document.getElementById('q-cout-recurrent').value) || 0,
    delai_mois: parseInt(document.getElementById('q-delai-json-range').value) || 6,
    niveau_impact: parseInt(document.getElementById('q-impact-level-input').value) || 0,
    niveau_faisabilite: parseInt(document.getElementById('q-faisabilite-level-input').value) || 0,
    niveau_acceptabilite: parseInt(document.getElementById('q-acceptabilite-level-input').value) || 0
  };
  data.cout_3_ans = data.cout_2026 + data.cout_2027 + data.cout_2028;
  Object.assign(piste, data);
  Object.assign(master, data);
  const sel = document.getElementById('track-select');
  const opt = sel.options[state.currentIndex];
  if (opt) {
    const rated = master.rating > 0 ? ` ★${master.rating}` : '';
    opt.textContent = `${master.numero} - ${master.titre}${rated}`;
  }
  state.lastSaved = new Date();
  const now = state.lastSaved;
  document.getElementById('save-status').textContent = `Dernière sauvegarde : ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
  updateScoresChart();
  updateProgress();
  showToast('Évaluation enregistrée ✓', 'success');
  return true;
}
function goNext() {
  if (state.filtered.length === 0) return;
  const next = (state.currentIndex + 1) % state.filtered.length;
  selectTrack(next);
}
function goPrev() {
  if (state.filtered.length === 0) return;
  const prev = (state.currentIndex - 1 + state.filtered.length) % state.filtered.length;
  selectTrack(prev);
}
function updateProgress() {
  const activePistes = getActivePistes();
  const total = activePistes.length;
  const rated = activePistes.filter(p => p.rating > 0).length;
  const avg = rated > 0
    ? (activePistes.filter(p => p.rating > 0).reduce((s, p) => s + p.rating, 0) / rated).toFixed(1)
    : '-';
  document.getElementById('total-count').textContent = total;
  document.getElementById('rated-count').textContent = rated;
  document.getElementById('stat-avg').textContent = avg === '-' ? '-' : `${avg}★`;
  document.getElementById('stat-rated').textContent = rated;
  document.getElementById('stat-remaining').textContent = total - rated;
  document.getElementById('progress-fill').style.width = `${total > 0 ? (rated / total) * 100 : 0}%`;
}
function priorityClass(p) {
  const map = { 'Quick Win': 'qw', 'Stratégique': 'st', 'Complémentaire': 'cp', 'Long Terme': 'lt' };
  return map[p] || 'cp';
}
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type ? 'toast--' + type : ''} show`;
  if (type === 'info') {
    t.style.background = '#2563eb'; 
  }
  setTimeout(() => { 
    t.className = `toast ${type ? 'toast--' + type : ''}`; 
  }, 2800);
}
function updateRangeDisplay(val) {
  document.getElementById('range-val').textContent = `${val} m`;
  document.getElementById('range-val-display').textContent = `${val} mois`;
}
function downloadJSON() {
  const data = { pistes: state.pistes };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cdg2026_safety_track_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('JSON téléchargé ✓', 'success');
}
function onSearch(val) {
  state.filterText = val.trim();
  applyFilters();
}
document.getElementById('q-cout-2026').addEventListener('input', updateTotalCout);
document.getElementById('q-cout-2027').addEventListener('input', updateTotalCout);
document.getElementById('q-cout-2028').addEventListener('input', updateTotalCout);
document.getElementById('q-delai-json-range').addEventListener('input', (e) => {
  updateDelaiRange(e.target.value);
});
setupStarInput('q-impact-level-input', 'impact-stars');
setupStarInput('q-faisabilite-level-input', 'faisabilite-stars');
setupStarInput('q-acceptabilite-level-input', 'acceptabilite-stars');
const criteriaStarsWidget = document.getElementById('criteria-stars-widget');
if (criteriaStarsWidget) {
  criteriaStarsWidget.parentElement.parentElement.style.display = 'none';
}
document.getElementById('search-input').addEventListener('input', e => {
  document.getElementById('search-input-mob').value = e.target.value;
  onSearch(e.target.value);
});
document.getElementById('btn-toggle-selector')?.addEventListener('click', () => {
  const selectorPanel = document.getElementById('panel_selector');
  if (!selectorPanel) return;
  const isHidden = getComputedStyle(selectorPanel).display === 'none';
  selectorPanel.style.display = isHidden ? 'block' : 'none';
});
document.getElementById('priority-filter').addEventListener('change', e => {
  state.filterPriority = e.target.value;
  document.querySelectorAll('#priority-pills .pill').forEach(p => {
    p.classList.toggle('active', p.dataset.priority === e.target.value);
  });
  applyFilters();
});
document.querySelectorAll('#priority-pills .pill').forEach(pill => {
  pill.addEventListener('click', () => {
    state.filterPriority = pill.dataset.priority;
    document.querySelectorAll('#priority-pills .pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    document.getElementById('priority-filter').value = state.filterPriority;
    applyFilters();
  });
});
document.getElementById('category-filter').addEventListener('change', e => {
  state.filterCategory = e.target.value;
  document.querySelectorAll('#category-pills .pill').forEach(p => {
    p.classList.toggle('active', p.dataset.category === e.target.value);
  });
  applyFilters();
});
document.querySelectorAll('#category-pills .pill').forEach(pill => {
  pill.addEventListener('click', () => {
    state.filterCategory = pill.dataset.category;
    document.querySelectorAll('#category-pills .pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    document.getElementById('category-filter').value = state.filterCategory;
    applyFilters();
  });
});
document.getElementById('rating-filter').addEventListener('change', e => {
  state.filterRating = parseInt(e.target.value);
  applyFilters();
});
document.getElementById('track-select').addEventListener('change', e => {
  if (e.target.value === '') return;
  selectTrack(parseInt(e.target.value));
});
const starsWidget = document.getElementById('stars-widget');
starsWidget.addEventListener('mouseover', e => {
  const btn = e.target.closest('.star-btn');
  if (!btn) return;
  const hover = parseInt(btn.dataset.star);
  document.querySelectorAll('.star-btn').forEach((b, i) => {
    b.style.color = i < hover ? 'var(--c-star)' : 'var(--c-star-empty)';
  });
});
starsWidget.addEventListener('mouseleave', () => {
  document.querySelectorAll('.star-btn').forEach(b => { b.style.color = ''; });
  renderStars(state.currentRating);
});
starsWidget.addEventListener('click', e => {
  const btn = e.target.closest('.star-btn');
  if (!btn) return;
  const val = parseInt(btn.dataset.star);
  state.currentRating = (state.currentRating === val) ? 0 : val;
  renderStars(state.currentRating);
});
document.getElementById('btn-save').addEventListener('click', saveCurrentTrack);
document.getElementById('btn-next').addEventListener('click', goNext);
document.getElementById('btn-prev').addEventListener('click', goPrev);
document.getElementById('btn-logout')?.addEventListener('click', () => {
  sessionStorage.removeItem('cdg2026_authenticated');
  sessionStorage.removeItem('cdg2026_user');
  window.location.href = 'login.html';
});
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight' || e.key === 'n') goNext();
  if (e.key === 'ArrowLeft'  || e.key === 'p') goPrev();
  if (e.key === 'Enter') saveCurrentTrack();
  if (e.key >= '1' && e.key <= '5') {
    state.currentRating = parseInt(e.key);
    renderStars(state.currentRating);
  }
});
function getRelationTypeLabel(type) {
  const labels = {
    'prerequisite': 'Prérequis',
    'synergy': 'Synergie',
    'feeds_data': 'Fournit des données',
    'conflict': 'Attention - Conflit',
    'process_flow': 'Processus'
  };
  return labels[type] || type;
}
function getRelationTypeIcon(type) {
  const icons = {
    'prerequisite': 'fa-solid fa-arrow-right',
    'synergy': 'fa-solid fa-handshake',
    'feeds_data': 'fa-solid fa-database',
    'conflict': 'fa-solid fa-circle-exclamation',
    'process_flow': 'fa-solid fa-diagram-next'
  };
  return icons[type] || 'fa-solid fa-link';
}
function displayRelations(piste) {
  const relationsContainer = document.getElementById('relations-container');
  const relationsList = document.getElementById('relations-list');
  const activeIndicator = document.getElementById('relations-active-count');
  if (activeIndicator) {
  const activePistes = getActivePistes();
  const activeNumeros = new Set(activePistes.map(p => p.numero));
  const activeRelations = piste.relations.filter(rel => activeNumeros.has(rel.target));
  const totalRelations = piste.relations ? piste.relations.length : 0;
  const activeCount = activeRelations.length;
  if (activeCount < totalRelations) {
    activeIndicator.style.display = 'inline-block';
    activeIndicator.textContent = `${activeCount}/${totalRelations} actives`;
    activeIndicator.title = `${totalRelations - activeCount} relation(s) masquée(s) car les pistes cibles sont désactivées`;
  } else {
    activeIndicator.style.display = 'none';
  }
}
  if (!piste.relations || piste.relations.length === 0) {
    relationsContainer.style.display = 'none';
    return;
  }
  const activePistes = getActivePistes();
  const activeNumeros = new Set(activePistes.map(p => p.numero));
  const activeRelations = piste.relations.filter(rel => activeNumeros.has(rel.target));
  if (activeRelations.length === 0) {
    relationsContainer.style.display = 'block';
    relationsList.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <i class="fa-solid fa-diagram-project"></i>
        <p>Les relations de cette piste pointent vers des pistes désactivées</p>
        <p style="font-size: 0.7rem;">Utilisez la modale de sélection pour les réactiver</p>
      </div>
    `;
    return;
  }
  relationsContainer.style.display = 'block';
  relationsList.innerHTML = '';
  const grouped = activeRelations.reduce((acc, rel) => {
    if (!acc[rel.type]) acc[rel.type] = [];
    acc[rel.type].push(rel);
    return acc;
  }, {});
  const typeOrder = ['prerequisite', 'feeds_data', 'synergy', 'process_flow', 'conflict'];
  typeOrder.forEach(type => {
    if (grouped[type]) {
      grouped[type].forEach(rel => {
        const item = document.createElement('div');
        item.className = 'relation-item';
        item.setAttribute('data-type', rel.type);
        const targetPiste = activePistes.find(p => p.numero === rel.target);
        const targetTitle = targetPiste ? targetPiste.titre : `Piste ${rel.target}`;
        const header = document.createElement('div');
        header.className = 'relation-header';
        header.innerHTML = `
          <i class="${getRelationTypeIcon(rel.type)}"></i>
          <span class="relation-type-badge ${rel.type}">${getRelationTypeLabel(rel.type)}</span>
        `;
        const targetDiv = document.createElement('div');
        targetDiv.className = 'relation-target';
        targetDiv.innerHTML = `
          <i class="fa-solid fa-arrow-right"></i>
          <a href="#" class="relation-link" data-target="${rel.target}">
            Piste ${rel.target} : ${targetTitle}
          </a>
        `;
        const reasonDiv = document.createElement('div');
        reasonDiv.className = 'relation-reason';
        reasonDiv.textContent = rel.reason || '';
        item.appendChild(header);
        item.appendChild(targetDiv);
        item.appendChild(reasonDiv);
        relationsList.appendChild(item);
      });
    }
  });
  const totalRelations = piste.relations.length;
  if (activeRelations.length < totalRelations) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'relations-filtered-message';
    messageDiv.innerHTML = `
      <i class="fa-solid fa-info-circle"></i>
      ${totalRelations - activeRelations.length} relation(s) masquée(s) (pistes cibles désactivées)
    `;
    relationsList.appendChild(messageDiv);
  }
  document.querySelectorAll('.relation-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetNumero = link.dataset.target;
      const activePistes = getActivePistes();
      const targetInActive = activePistes.find(p => p.numero === targetNumero);
      if (!targetInActive) {
        showToast('Cette piste est désactivée. Utilisez la modale de sélection pour la réactiver.', 'warn');
        return;
      }
      const targetFilteredIndex = state.filtered.findIndex(p => p.numero === targetNumero);
      if (targetFilteredIndex >= 0) {
        selectTrack(targetFilteredIndex);
      } else {
        const allIndex = activePistes.findIndex(p => p.numero === targetNumero);
        if (allIndex >= 0) {
          state.filterText = '';
          state.filterPriority = '';
          state.filterCategory = '';
          state.filterRating = 0;
          document.getElementById('search-input').value = '';
          document.getElementById('search-input-mob').value = '';
          document.getElementById('priority-filter').value = '';
          document.getElementById('category-filter').value = '';
          document.getElementById('rating-filter').value = '0';
          document.querySelectorAll('#priority-pills .pill').forEach(p => {
            p.classList.toggle('active', p.dataset.priority === '');
          });
          document.querySelectorAll('#category-pills .pill').forEach(p => {
            p.classList.toggle('active', p.dataset.category === '');
          });
          applyFilters();
          const newIndex = state.filtered.findIndex(p => p.numero === targetNumero);
          if (newIndex >= 0) {
            selectTrack(newIndex);
          }
        }
      }
    });
  });
}
function refreshRelationsTab() {
  if (currentPisteTab === 'relations' && state.currentIndex >= 0) {
    const piste = state.filtered[state.currentIndex];
    if (piste) {
      displayRelations(piste);
    }
  }
}
const SIMULATION_MODEL = {
  horizonYears: 5,
  weights: {
    impact: 0.35,
    faisabilite: 0.25,
    acceptabilite: 0.20,
    rating: 0.10,
    priorite: 0.10
  }
};
function clampScore(value, fallback = 2.5) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(0, n));
}
function getPriorityScore(piste) {
  const explicit = Number(piste.priorite_score);
  if (Number.isFinite(explicit)) return clampScore(explicit, 3);
  switch (piste.priorite) {
    case 'Quick Win': return 5;
    case 'Stratégique': return 4;
    case 'Complémentaire': return 3;
    case 'Long Terme': return 2;
    default: return 3;
  }
}
function computeSimulationScore(piste, useScores = true) {
  const impact = clampScore(piste.niveau_impact, 2.5);
  const faisabilite = clampScore(piste.niveau_faisabilite, 2.5);
  const acceptabilite = clampScore(piste.niveau_acceptabilite, 2.5);
  const rating = useScores ? clampScore(piste.rating, 0) : 2.5;
  const prioriteScore = getPriorityScore(piste);
  const w = SIMULATION_MODEL.weights;
  const score0to5 =
    (impact * w.impact) +
    (faisabilite * w.faisabilite) +
    (acceptabilite * w.acceptabilite) +
    (rating * w.rating) +
    (prioriteScore * w.priorite);
  return score0to5 * 20;
}
function computeSimulationCost(piste, horizonYears = SIMULATION_MODEL.horizonYears) {
  const cout3AnsChamp = Number(piste.cout_3_ans) || 0;
  const cout3AnsSomme =
    (Number(piste.cout_2026) || 0) +
    (Number(piste.cout_2027) || 0) +
    (Number(piste.cout_2028) || 0);
  const capex3Ans = cout3AnsChamp > 0 ? cout3AnsChamp : cout3AnsSomme;
  const opex = (Number(piste.cout_recurrent_annuel) || 0) * horizonYears;
  const total = capex3Ans + opex;
  return total > 0 ? total : getDefaultCost(piste.priorite);
}
function optimizePistes(pistes, budgetMax, maxPistes, maxDurationMonths = Infinity, filterPriority = '', filterCategory = '', useScores = true, ignoreRelations = false) {
 const activePistes = getActivePistes();
  let availablePistes = activePistes.filter(p => {
    if (filterPriority && p.priorite !== filterPriority) return false;
    if (filterCategory && p.categorie !== filterCategory) return false;
    return true;
  });
  const pisteScores = availablePistes.map(p => {
    const score = computeSimulationScore(p, useScores);
    const cout = computeSimulationCost(p);
    const delai = Number(p.delai_mois) || 12;
    return {
      piste: p,
      score: score,
      cout: cout,
      delai: delai
    };
  });
  if (ignoreRelations) {
    return greedySelection(pisteScores, budgetMax, maxPistes, maxDurationMonths);
  } else {
    return relationBasedSelection(pisteScores, budgetMax, maxPistes, maxDurationMonths, pistes);
  }
}
function getDefaultCost(priorite) {
  switch(priorite) {
    case 'Quick Win': return 200000; 
    case 'Stratégique': return 800000; 
    case 'Complémentaire': return 400000; 
    case 'Long Terme': return 600000; 
    default: return 500000; 
  }
}
function greedySelection(pisteScores, budgetMax, maxPistes, maxDurationMonths = Infinity) {
  const sorted = [...pisteScores].sort((a, b) => (b.score / b.cout) - (a.score / a.cout));
  let selected = [];
  let budgetUsed = 0;
  let durationUsed = 0;
  for (let item of sorted) {
    if (selected.length >= maxPistes) break;
    if ((budgetUsed + item.cout <= budgetMax) && (durationUsed + item.delai <= maxDurationMonths)) {
      selected.push(item);
      budgetUsed += item.cout;
      durationUsed += item.delai;
    } else {
      const reasons = [];
      if (budgetUsed + item.cout > budgetMax) reasons.push(`budget restant ${budgetMax - budgetUsed}`);
      if (durationUsed + item.delai > maxDurationMonths) reasons.push(`durée restante ${maxDurationMonths - durationUsed} mois`);
    }
  }
  return selected;
}
function relationBasedSelection(pisteScores, budgetMax, maxPistes, maxDurationMonths, allPistes) {
  const relationGraph = {};
  const dependencyMap = {};
  allPistes.forEach(p => {
    relationGraph[p.numero] = [];
    dependencyMap[p.numero] = [];
    if (p.relations) {
      relationGraph[p.numero] = p.relations.map(r => ({
        target: r.target,
        type: r.type,
        reason: r.reason
      }));
    }
  });
  allPistes.forEach(source => {
    (source.relations || []).forEach(rel => {
      if (rel.type === 'prerequisite' && dependencyMap[rel.target]) {
        dependencyMap[rel.target].push(source.numero);
      }
      if (rel.type === 'requires' && dependencyMap[source.numero]) {
        dependencyMap[source.numero].push(rel.target);
      }
    });
  });
  const enhancedScores = pisteScores.map(item => {
    let synergyBonus = 0;
    const relations = relationGraph[item.piste.numero] || [];
    relations.forEach(rel => {
      if (rel.type === 'synergy') synergyBonus += 5;
      if (rel.type === 'feeds_data') synergyBonus += 3;
      if (rel.type === 'process_flow') synergyBonus += 2;
      if (rel.type === 'prerequisite') synergyBonus -= 2; 
    });
    return {
      ...item,
      synergyBonus,
      scoreTotal: item.score + synergyBonus
    };
  });
  const sorted = [...enhancedScores].sort((a, b) => 
    (b.scoreTotal / b.cout) - (a.scoreTotal / a.cout)
  );
  let selected = [];
  let budgetUsed = 0;
  let durationUsed = 0;
  let selectedNumeros = new Set();
  for (let item of sorted) {
    if (selected.length >= maxPistes) break;
    if (budgetUsed + item.cout > budgetMax) continue;
    if (durationUsed + item.delai > maxDurationMonths) continue;
    const prerequisites = dependencyMap[item.piste.numero] || [];
    const hasAllPrereqs = prerequisites.every(preq => selectedNumeros.has(preq));
    if (hasAllPrereqs) {
      selected.push(item);
      selectedNumeros.add(item.piste.numero);
      budgetUsed += item.cout;
      durationUsed += item.delai;
    } else {
    }
  }
  if (selected.length === 0 && pisteScores.length > 0) {
    console.warn('Aucune solution stricte avec relations, fallback sur sélection gloutonne');
    return greedySelection(pisteScores, budgetMax, maxPistes, maxDurationMonths);
  }
  return selected;
}
function calculateTotalScore(selected) {
  return selected.reduce((sum, item) => sum + item.score + (item.synergyBonus || 0), 0);
}
function formatBudget(budget) {
  if (budget >= 1000000) {
    return (budget / 1000000).toFixed(1) + ' M€';
  }
  return (budget / 1000).toFixed(0) + ' k€';
}
function syncSimulationMaxPistes() {
  const maxPistesInput = document.getElementById('sim-max-pistes');
  const maxPistesDisplay = document.getElementById('max-pistes-display');
  const maxPistesDisplayRange = document.getElementById('synthese-total-pistes-range');
  if (!maxPistesInput || !maxPistesDisplay) return;
  const activePistes = getActivePistes();
  const totalPistes = Math.max(activePistes.length, 1);
  if (maxPistesDisplayRange) {
    maxPistesDisplayRange.textContent = activePistes.length;
  }
  maxPistesInput.max = totalPistes;
  if (parseInt(maxPistesInput.value, 10) > totalPistes) {
    maxPistesInput.value = totalPistes;
  }
  maxPistesDisplay.textContent = maxPistesInput.value;
}
function initSimulation() {
  const viewParamsBtn = document.getElementById('view-params');
  const viewResultsBtn = document.getElementById('view-results');
  const viewListBtn = document.getElementById('view-list');
  const viewTimelineBtn = document.getElementById('view-timeline');
  const paramsPanel = document.querySelector('.simulation-params');
  const resultsHeader = document.querySelector('.simulation-results .results-header');
  const resultsSummary = document.querySelector('.simulation-results .results-summary');
  const resultsStats = document.getElementById('simulation-results-stats');
  const resultsExport = document.querySelector('.simulation-results .simulation-export');
  const resultsList = document.querySelector('.results-list');
  const timelineDiv = document.getElementById('simulation-timeline');
  const modal = document.getElementById('simulation-modal');
  const openBtn = document.getElementById('btn-simulation');
  const closeBtn = document.getElementById('simulation-close');
  const runBtn = document.getElementById('sim-run');
  const resetBtn = document.getElementById('sim-reset');
  const exportBtn = document.getElementById('sim-export');
  const budgetInput = document.getElementById('sim-budget');
  const maxPistesInput = document.getElementById('sim-max-pistes');
  const maxDurationInput = document.getElementById('sim-max-duration');
  const budgetDisplay = document.getElementById('budget-display');
  const maxPistesDisplay = document.getElementById('max-pistes-display');
  const maxDurationDisplay = document.getElementById('max-duration-display');
  const prioriteSelect = document.getElementById('sim-priorite');
  const categorieSelect = document.getElementById('sim-categorie');
  const useScoresCheck = document.getElementById('sim-use-scores');
  const ignoreRelationsCheck = document.getElementById('sim-ignore-relations');
  const resultsDiv = document.getElementById('simulation-results');
  let simulationHasResults = false;
  function setSimulationTab(tabName) {
    if (!paramsPanel || !resultsDiv || !resultsList || !timelineDiv || !viewResultsBtn) return;
    viewParamsBtn.classList.toggle('active', tabName === 'params');
    viewResultsBtn.classList.toggle('active', tabName === 'results');
    viewListBtn.classList.toggle('active', tabName === 'list');
    viewTimelineBtn.classList.toggle('active', tabName === 'timeline');
    if (tabName === 'params') {
      paramsPanel.style.display = 'block';
      resultsDiv.style.display = 'none';
      return;
    }
    if (!simulationHasResults) {
      showToast('Lancez d\'abord une simulation pour afficher les résultats', 'info');
      paramsPanel.style.display = 'block';
      resultsDiv.style.display = 'none';
      viewParamsBtn.classList.add('active');
      viewResultsBtn.classList.remove('active');
      viewListBtn.classList.remove('active');
      viewTimelineBtn.classList.remove('active');
      return;
    }
    paramsPanel.style.display = 'none';
    resultsDiv.style.display = 'block';
    if (resultsHeader) resultsHeader.style.display = tabName === 'results' ? 'flex' : 'none';
    if (resultsSummary) resultsSummary.style.display = tabName === 'results' ? 'grid' : 'none';
    if (resultsStats) resultsStats.style.display = tabName === 'results' ? 'block' : 'none';
    if (resultsExport) resultsExport.style.display = tabName === 'results' ? 'flex' : 'none';
    resultsList.style.display = tabName === 'list' ? 'block' : 'none';
    timelineDiv.style.display = tabName === 'timeline' ? 'block' : 'none';
  }
  viewParamsBtn.addEventListener('click', () => setSimulationTab('params'));
  viewResultsBtn.addEventListener('click', () => setSimulationTab('results'));
  viewListBtn.addEventListener('click', () => setSimulationTab('list'));
  viewTimelineBtn.addEventListener('click', () => setSimulationTab('timeline'));
  budgetInput.addEventListener('input', () => {
    budgetDisplay.textContent = formatBudget(parseInt(budgetInput.value));
  });
  maxPistesInput.addEventListener('input', () => {
    maxPistesDisplay.textContent = maxPistesInput.value;
  });
  syncSimulationMaxPistes();
  maxDurationInput.addEventListener('input', () => {
    maxDurationDisplay.textContent = `${maxDurationInput.value} mois`;
  });
  openBtn.addEventListener('click', () => {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    setSimulationTab('params');
  });
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  });
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  });
  const maxParallelInput = document.getElementById('sim-max-parallel');
  const maxParallelDisplay = document.getElementById('max-parallel-display');
  maxParallelInput.addEventListener('input', () => {
    maxParallelDisplay.textContent = maxParallelInput.value;
  });
const maxParallel = parseInt(maxParallelInput.value);
  runBtn.addEventListener('click', () => {
    const budget = parseInt(budgetInput.value);
    const maxPistes = parseInt(maxPistesInput.value);
    const maxDurationMonths = parseInt(maxDurationInput.value);
    const priorite = prioriteSelect.value;
    const categorie = categorieSelect.value;
    const useScores = useScoresCheck.checked;
    const ignoreRelations = ignoreRelationsCheck.checked;
    const selected = optimizePistes(
      state.pistes,
      budget,
      maxPistes,
      maxDurationMonths,
      priorite,
      categorie,
      useScores,
      ignoreRelations
    );
    displaySimulationResults(selected, budget);
    simulationHasResults = true;
    setSimulationTab('results');
  });
  resetBtn.addEventListener('click', () => {
    const totalPistes = Math.max(state.pistes.length, 1);
    budgetInput.value = 3000000;
    maxPistesInput.value = Math.min(15, totalPistes);
    maxDurationInput.value = 36;
    prioriteSelect.value = '';
    categorieSelect.value = '';
    useScoresCheck.checked = true;
    ignoreRelationsCheck.checked = false;
    budgetDisplay.textContent = formatBudget(3000000);
    maxPistesDisplay.textContent = maxPistesInput.value;
    maxDurationDisplay.textContent = '36 mois';
    simulationHasResults = false;
    setSimulationTab('params');
  });
  exportBtn.addEventListener('click', () => {
    const selectedItems = document.querySelectorAll('.selected-piste-item');
    const selectedNumeros = Array.from(selectedItems).map(item => item.dataset.numero);
    if (selectedNumeros.length === 0) return;
    state.filtered = state.pistes.filter(p => selectedNumeros.includes(p.numero));
    if (state.filtered.length > 0) {
      selectTrack(0);
    }
    updateProgress();
    initScoresChart();
    modal.style.display = 'none';
    document.body.style.overflow = '';
    showToast(`${selectedNumeros.length} pistes chargées dans la sélection`, 'success');
  });
}
function displaySimulationResults(selected, budgetMax) {
  const resultsDiv = document.getElementById('simulation-results');
  const listDiv = document.getElementById('selected-pistes-list');
  const statsDiv = document.getElementById('simulation-results-stats');
  const resultBudgetUsed = document.getElementById('result-budget-used');
  const resultCount = document.getElementById('result-count');
  const resultBudget = document.getElementById('result-budget');
  resultBudget.textContent = formatBudget(budgetMax);
  if (selected.length === 0) {
    listDiv.innerHTML = '<div class="selected-piste-item" style="justify-content: center;">Aucune piste ne correspond aux critères</div>';
    if (statsDiv) statsDiv.innerHTML = '';
    resultBudgetUsed.textContent = '0 €';
    resultCount.textContent = '0';
    return;
  }
  const budgetUsed = selected.reduce((sum, item) => sum + item.cout, 0);
  resultBudgetUsed.textContent = formatBudget(budgetUsed);
  resultCount.textContent = selected.length;
  listDiv.innerHTML = '';
  selected.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'selected-piste-item';
    div.dataset.numero = item.piste.numero;
    div.dataset.index = index;
    const relations = item.piste.relations || [];
    let relationIndicator = '';
    if (relations.length > 0) {
      const types = relations.map(r => r.type);
      if (types.includes('prerequisite')) relationIndicator = 'prerequisite';
      else if (types.includes('conflict')) relationIndicator = 'conflict';
      else if (types.includes('synergy')) relationIndicator = 'synergy';
      else if (types.includes('feeds_data')) relationIndicator = 'feeds_data';
      else if (types.includes('process_flow')) relationIndicator = 'process_flow';
    }
    div.innerHTML = `
      <div>
        <strong>Piste ${item.piste.numero}</strong> : ${item.piste.titre}
        ${relationIndicator ? `<span class="piste-relations-indicator ${relationIndicator}"></span>` : ''}
        <span style="font-size:0.7rem; color:var(--c-text-muted); margin-left:6px;">(${item.delai} mois)</span>
      </div>
      <div class="piste-score">${ Math.round(item.score)} pts</div>
    `;
    div.addEventListener('click', () => {
      const filteredIndex = state.filtered.findIndex(p => p.numero === item.piste.numero);
      if (filteredIndex >= 0) {
        selectTrack(filteredIndex);
        document.getElementById('simulation-modal').style.display = 'none';
        document.body.style.overflow = '';
      }
    });
    listDiv.appendChild(div);
  });
  const maxParallel = parseInt(document.getElementById('sim-max-parallel').value);
  displayOptimizedTimeline(selected, maxParallel);
}
function calculateTimelinePositions(selectedPistes, order) {
  const startDate = new Date(); 
  const positions = [];
  let currentDate = startDate;
  order.forEach(numero => {
    const item = selectedPistes.find(i => i.piste.numero === numero);
    const delai = item.delai || 6; 
    positions.push({
      ...item,
      numero: numero,
      startDate: new Date(currentDate),
      endDate: new Date(currentDate.setMonth(currentDate.getMonth() + delai)),
      delai: delai
    });
  });
  return positions;
}
function selectTrackFromTimeline(numero) {
  const filteredIndex = state.filtered.findIndex(p => p.numero === numero);
  if (filteredIndex >= 0) {
    selectTrack(filteredIndex);
    document.getElementById('simulation-modal').style.display = 'none';
    document.body.style.overflow = '';
  }
}
function scheduleOptimal(selectedPistes, maxParallel) {
  const selectedNumeros = new Set(selectedPistes.map(item => item.piste.numero));
  const dependenciesByNumero = {};
  selectedPistes.forEach(item => {
    dependenciesByNumero[item.piste.numero] = [];
  });
  selectedPistes.forEach(sourceItem => {
    const sourceNumero = sourceItem.piste.numero;
    (sourceItem.piste.relations || []).forEach(rel => {
      if (rel.type === 'prerequisite' && selectedNumeros.has(rel.target)) {
        dependenciesByNumero[rel.target].push(sourceNumero);
      }
      if (rel.type === 'requires' && selectedNumeros.has(rel.target)) {
        dependenciesByNumero[sourceNumero].push(rel.target);
      }
    });
  });
  const pistes = selectedPistes.map(item => ({
    ...item,
    numero: item.piste.numero,
    titre: item.piste.titre,
    duree: item.delai || 6,
    dependances: dependenciesByNumero[item.piste.numero] || []
  }));
  const graphe = {};
  pistes.forEach(p => {
    graphe[p.numero] = {
      ...p,
      dependants: [],
      planifie: false,
      debut: null,
      fin: null,
      ligne: null
    };
  });
  pistes.forEach(p => {
    p.dependances.forEach(dep => {
      if (graphe[dep]) {
        graphe[dep].dependants.push(p.numero);
      }
    });
  });
  const lignes = Array(maxParallel).fill().map(() => ({
    disponible: 0, 
    pistes: []
  }));
  const planifies = [];
  const debutGlobal = 0; 
  while (Object.values(graphe).some(p => !p.planifie)) {
    let pretes = Object.values(graphe).filter(p => 
      !p.planifie && 
      p.dependances.every(dep => graphe[dep]?.planifie)
    );
    if (pretes.length === 0) {
      const nonPlanifiees = Object.values(graphe).filter(p => !p.planifie);
      nonPlanifiees.sort((a, b) => {
        const aMissing = a.dependances.filter(dep => !graphe[dep]?.planifie).length;
        const bMissing = b.dependances.filter(dep => !graphe[dep]?.planifie).length;
        if (aMissing !== bMissing) return aMissing - bMissing;
        return b.duree - a.duree;
      });
      if (nonPlanifiees.length === 0) break;
      pretes = [nonPlanifiees[0]];
      console.warn('Cycle détecté dans les dépendances timeline, fallback sur planification partielle');
    }
    pretes.sort((a, b) => b.duree - a.duree);
    for (let piste of pretes) {
      let debutAuPlusTot = 0;
      if (piste.dependances.length > 0) {
        debutAuPlusTot = Math.max(...piste.dependances.map(dep => graphe[dep].fin));
      }
      let meilleureLigne = -1;
      let meilleurDebut = Infinity;
      for (let i = 0; i < lignes.length; i++) {
        const ligne = lignes[i];
        const debutPossible = Math.max(ligne.disponible, debutAuPlusTot);
        if (debutPossible < meilleurDebut) {
          meilleurDebut = debutPossible;
          meilleureLigne = i;
        }
      }
      if (meilleureLigne >= 0) {
        const ligne = lignes[meilleureLigne];
        const debut = Math.max(ligne.disponible, debutAuPlusTot);
        const fin = debut + piste.duree;
        piste.planifie = true;
        piste.debut = debut;
        piste.fin = fin;
        piste.ligne = meilleureLigne;
        ligne.disponible = fin;
        ligne.pistes.push({
          numero: piste.numero,
          titre: piste.titre,
          debut: debut,
          fin: fin,
          duree: piste.duree
        });
        planifies.push(piste);
      }
    }
  }
  return { planifies, lignes, dureeTotale: Math.max(...lignes.map(l => l.disponible)) };
}
function displayOptimizedTimeline(selectedPistes, maxParallel) {
  const timelineDiv = document.getElementById('simulation-timeline');
  const container = document.getElementById('timeline-container');
  if (!selectedPistes || selectedPistes.length === 0) {
    timelineDiv.style.display = 'none';
    return;
  }
  timelineDiv.style.display = 'block';
  const { planifies, lignes, dureeTotale } = scheduleOptimal(selectedPistes, maxParallel);
  const timelineWidth = Math.max(800, dureeTotale * 40 + 200);
  const ligneHeight = 80;
  const timelineHeight = maxParallel * ligneHeight + 100;
  let html = `
    <div class="timeline-track" style="width: ${timelineWidth}px; height: ${timelineHeight}px; background: #f8fafc; border: 1px solid var(--c-border); border-radius: 12px;">
      <div class="timeline-years">
  `;
  for (let mois = 0; mois <= dureeTotale; mois += 3) {
    const left = mois * 40 + 50;
    const annee = Math.floor(mois / 12);
    const moisRestant = mois % 12;
    html += `<div class="timeline-year-mark" style="left: ${left}px;" 
                  title="Mois ${mois} (${annee} an${annee > 1 ? 's' : ''} ${moisRestant} mois)">
              ${mois === 0 ? 'Début' : `M${mois}`}
            </div>`;
  }
  html += `</div><div class="timeline-items">`;
  for (let i = 0; i < maxParallel; i++) {
    const y = 50 + i * ligneHeight;
    html += `<div class="timeline-level-line" style="top: ${y}px; width: ${timelineWidth}px;"></div>`;
    html += `<div class="timeline-level-label" style="top: ${y + 10}px;">Ligne ${i + 1}</div>`;
  }
  planifies.forEach(piste => {
    const startOffset = piste.debut * 40 + 50;
    const width = piste.duree * 40;
    const y = 50 + piste.ligne * ligneHeight + 20;
    let bgColor;
    let borderColor;
    let textColor;
    switch(piste.piste.priorite) {
      case 'Quick Win':
        bgColor = 'rgba(5, 150, 105, 0.15)';
        borderColor = '#059669';
        textColor = '#059669';
        break;
      case 'Stratégique':
        bgColor = 'rgba(217, 119, 6, 0.15)';
        borderColor = '#d97706';
        textColor = '#d97706';
        break;
      case 'Complémentaire':
        bgColor = 'rgba(37, 99, 235, 0.15)';
        borderColor = '#2563eb';
        textColor = '#2563eb';
        break;
      case 'Long Terme':
        bgColor = 'rgba(124, 58, 237, 0.15)';
        borderColor = '#7c3aed';
        textColor = '#7c3aed';
        break;
      default:
        bgColor = 'rgba(156, 163, 175, 0.15)';
        borderColor = '#9ca3af';
        textColor = '#9ca3af';
    }
    const relations = piste.piste.relations || [];
    let relationType = 'default';
    if (relations.some(r => r.type === 'prerequisite')) relationType = 'prerequisite';
    const pisteData = piste.piste;
    const score = pisteData.rating || 0;
    const priorite = pisteData.priorite || 'Non définie';
    const categorie = pisteData.categorie || 'Non définie';
    const delai = piste.duree;
    const faisabiliteVal = Number(pisteData.niveau_faisabilite);
    const impactVal = Number(pisteData.niveau_impact);
    const faisabilite = Number.isFinite(faisabiliteVal) ? `${clampScore(faisabiliteVal, 0).toFixed(1)} / 5` : 'Non évaluée';
    const impact = Number.isFinite(impactVal) ? `${clampScore(impactVal, 0).toFixed(1)} / 5` : 'Non évalué';
    const relations_count = relations.length;
    const tooltipContent = `
      <div style="text-align: left; max-width: 250px;">
        <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 5px; color: ${borderColor};">
          Piste ${pisteData.numero} : ${pisteData.titre}
        </div>
        <div style="margin: 5px 0; font-style: italic; color: #555;">
          "${pisteData.slogan || 'Pas de slogan'}"
        </div>
        <hr style="margin: 5px 0; border-color: #ddd;">
        <table style="width:100%; font-size: 0.75rem; border-collapse: collapse;">
          <tr><td style="padding: 2px 0;"><strong>Score :</strong></td><td style="padding: 2px 0; text-align: right;">${score} / 5 ⭐</td></tr>
          <tr><td style="padding: 2px 0;"><strong>Priorité :</strong></td><td style="padding: 2px 0; text-align: right; color: ${borderColor}; font-weight: 600;">${priorite}</td></tr>
          <tr><td style="padding: 2px 0;"><strong>Catégorie :</strong></td><td style="padding: 2px 0; text-align: right;">${categorie}</td></tr>
          <tr><td style="padding: 2px 0;"><strong>Durée :</strong></td><td style="padding: 2px 0; text-align: right;">${delai} mois</td></tr>
          <tr><td style="padding: 2px 0;"><strong>Planning :</strong></td><td style="padding: 2px 0; text-align: right;">mois ${piste.debut} → mois ${piste.fin}</td></tr>
          <tr><td style="padding: 2px 0;"><strong>Faisabilité :</strong></td><td style="padding: 2px 0; text-align: right;">${faisabilite}</td></tr>
          <tr><td style="padding: 2px 0;"><strong>Impact :</strong></td><td style="padding: 2px 0; text-align: right;">${impact}</td></tr>
          <tr><td style="padding: 2px 0;"><strong>Relations :</strong></td><td style="padding: 2px 0; text-align: right;">${relations_count}</td></tr>
        </table>
      </div>
    `;
    html += `
      <div class="timeline-item-optimized ${relationType}" 
           style="left: ${startOffset}px; top: ${y}px; width: ${width}px; 
                  background: ${bgColor}; border-left-color: ${borderColor};"
           data-numero="${piste.piste.numero}"
           data-tooltip='${tooltipContent.replace(/'/g, "&apos;")}'
           onclick="selectTrackFromTimeline('${piste.piste.numero}')">
        <div class="timeline-item-num" style="color: ${borderColor};">P${piste.piste.numero}</div>
        <div class="timeline-item-title">${piste.piste.titre.substring(0, 12)}${piste.piste.titre.length > 12 ? '…' : ''}</div>
        <div class="timeline-item-duration">
          <i class="fa-regular fa-clock" style="color: ${borderColor};"></i> ${piste.duree}m
        </div>
        <div class="timeline-item-period" style="background: ${borderColor}20; color: ${borderColor};">
          ${piste.debut}-${piste.fin}
        </div>
        <div class="timeline-item-priority" style="background: ${borderColor};">
          ${piste.piste.priorite === 'Quick Win' ? 'QW' : 
            piste.piste.priorite === 'Stratégique' ? 'S' : 
            piste.piste.priorite === 'Complémentaire' ? 'C' : 
            piste.piste.priorite === 'Long Terme' ? 'LT' : ''}
        </div>
      </div>
    `;
  });
  html += `</div></div>`;
  container.innerHTML = html;
  displayScheduleStats(planifies, dureeTotale);
  enableCustomTooltips();
}
function enableCustomTooltips() {
  const tooltipElements = document.querySelectorAll('[data-tooltip]');
  tooltipElements.forEach(el => {
    el.addEventListener('mouseenter', (e) => {
      const tooltipText = el.dataset.tooltip;
      const tooltip = document.createElement('div');
      tooltip.className = 'custom-tooltip-popup';
      tooltip.innerHTML = tooltipText;
      tooltip.style.position = 'fixed';
      tooltip.style.zIndex = '9999';
      document.body.appendChild(tooltip);
      const rect = el.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
      let top = rect.top - tooltipRect.height - 10;
      if (left < 10) left = 10;
      if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
      }
      if (top < 10) {
        top = rect.bottom + 10;
        tooltip.classList.add('bottom');
      }
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
      el._tooltip = tooltip;
    });
    el.addEventListener('mouseleave', () => {
      if (el._tooltip) {
        el._tooltip.remove();
        el._tooltip = null;
      }
    });
  });
}
function displayScheduleStats(planifies, dureeTotale) {
  const scoreMoyen = planifies.reduce((acc, p) => acc + (p.piste.rating || 0), 0) / planifies.length;
  const quickWins = planifies.filter(p => p.piste.priorite === 'Quick Win').length;
  const strategiques = planifies.filter(p => p.piste.priorite === 'Stratégique').length;
  const complementaires = planifies.filter(p => p.piste.priorite === 'Complémentaire').length;
  const longTerme = planifies.filter(p => p.piste.priorite === 'Long Terme').length;
  const statsHtml = `
    <div class="schedule-stats">
      <div class="stat-card">
        <div class="stat-label">Durée totale du projet</div>
        <div class="stat-value">${dureeTotale} mois</div>
        <div class="stat-detail">${Math.floor(dureeTotale / 12)} an${Math.floor(dureeTotale / 12) > 1 ? 's' : ''} ${dureeTotale % 12} mois</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pistes planifiées</div>
        <div class="stat-value">${planifies.length}</div>
        <div class="stat-detail">sur ${state.pistes.length} totales</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Score moyen</div>
        <div class="stat-value">${scoreMoyen.toFixed(1)}</div>
        <div class="stat-detail">/ 5</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Quick Wins</div>
        <div class="stat-value" style="color: #059669;">${quickWins}</div>
        <div class="stat-detail"> ${((quickWins/planifies.length)*100).toFixed(0)}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Stratégiques</div>
        <div class="stat-value" style="color: #d97706;">${strategiques}</div>
        <div class="stat-detail"> ${((strategiques/planifies.length)*100).toFixed(0)}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Complémentaires</div>
        <div class="stat-value" style="color: #2563eb;">${complementaires}</div>
        <div class="stat-detail"> ${((complementaires/planifies.length)*100).toFixed(0)}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Long Terme</div>
        <div class="stat-value" style="color: #7c3aed;">${longTerme}</div>
        <div class="stat-detail"> ${((longTerme/planifies.length)*100).toFixed(0)}%</div>
      </div>
    </div>
  `;
  const container = document.getElementById('simulation-results-stats');
  if (!container) return;
  container.innerHTML = statsHtml;
}
function showDetailInMain2(piste) {
  const modal = document.getElementById('detail-modal');
  const modalTitle = document.getElementById('detail-modal-title');
  const modalBody = document.getElementById('detail-modal-body');
  modalTitle.textContent = `Fiche interactive - Piste ${piste.numero}`;
  const badgeClass = priorityClass(piste.priorite);
  let html = `
    <div class="detail-sheet" id="interactive-sheet">
      <div class="detail-header">
        <div class="detail-image-container">
          ${piste.image ? 
            `<img src="${piste.image}" alt="Piste ${piste.numero}">` : 
            `<span style="font-size:3rem;">🛫</span>`
          }
        </div>
        <div class="detail-title-section">
          <div class="detail-numero">PISTE #${piste.numero}</div>
          <div class="detail-titre">${piste.titre}</div>
          <div class="detail-slogan">${piste.slogan || ''}</div>
          <div class="detail-badges">
            <span class="detail-badge priorite">${piste.priorite}</span>
            <span class="detail-badge categorie">${piste.categorie}</span>
          </div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">
          <i class="fa-solid fa-align-left"></i>
          Description
        </div>
        <div class="detail-description">
          ${piste.description_details}
        </div>
      </div>
  `;
  if (piste.conviction) {
    html += `
      <div class="detail-section">
        <div class="detail-section-title">
          <i class="fa-solid fa-quote-left"></i>
          Notre conviction
        </div>
        <div class="detail-conviction">
          ${piste.conviction}
        </div>
      </div>
    `;
  }
  if (piste.propositions && piste.propositions.length > 0) {
    html += `
      <div class="detail-section">
        <div class="detail-section-title">
          <i class="fa-solid fa-list-check"></i>
          Ce que nous proposons concrètement xxxxxxxxxxxxxxxxxxxxxxxxxxxx
        </div>
        <ul class="detail-propositions">
          ${piste.propositions.map(prop => `<li>${prop}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  html += `</div>`;
  modalBody.innerHTML = html;
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
}
function toggleRexDetail(header) {
  const content = header.nextElementSibling;
  const icon = header.querySelector('.rex-toggle');
  if (content.style.maxHeight) {
    content.style.maxHeight = null;
    icon.style.transform = 'rotate(0deg)';
  } else {
    content.style.maxHeight = content.scrollHeight + 'px';
    icon.style.transform = 'rotate(180deg)';
  }
}
function initRexToggles() {
  document.querySelectorAll('.detail-rex-header').forEach(header => {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.rex-toggle');
    content.style.maxHeight = null;
    icon.style.transform = 'rotate(0deg)';
    header.replaceWith(header.cloneNode(true));
    const newHeader = header.parentNode.querySelector('.detail-rex-header');
    newHeader.addEventListener('click', function() {
      toggleRexDetail(this);
    });
  });
}
function printDetailSheet() {
  window.print();
}
function initDetailModal() {
  const modal = document.getElementById('detail-modal');
  const closeBtn = document.getElementById('detail-close');
  const printBtn = document.getElementById('print-details');
  const showSyntheseBtn = document.getElementById('btn-show-synthese');
  const showDetailsBtn = document.getElementById('btn-show-details');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    });
  }
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'block') {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  });
  if (printBtn) {
    printBtn.addEventListener('click', printDetailSheet);
  }
  if (showDetailsBtn) {
    showDetailsBtn.addEventListener('click', () => {
      const piste = state.filtered[state.currentIndex];
      if (piste) {
        showDetailPageInModal(piste);
      } else {
        showToast('Veuillez sélectionner une piste', 'warn');
      }
    });
  }
}
function showDetailPageInModal(piste) {
  const modal = document.getElementById('detail-page-modal');
  const modalTitle = document.getElementById('detail-page-modal-title');
  const iframe = document.getElementById('detail-page-iframe');
  const closeBtn = document.getElementById('detail-page-close');
  const printBtn = document.getElementById('detail-page-print');
  const openBtn = document.getElementById('detail-page-open');
  if (!modal || !iframe) return;
  const url = `pistes/piste${piste.numero}.html`;
  modalTitle.textContent = `Piste ${piste.numero} : ${piste.titre}`;
  iframe.src = url;
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
  const closeModal = () => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    setTimeout(() => { iframe.src = ''; }, 300);
  };
  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
  newCloseBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeModal();
    }
  });
  const newPrintBtn = printBtn.cloneNode(true);
  printBtn.parentNode.replaceChild(newPrintBtn, printBtn);
  newPrintBtn.addEventListener('click', () => {
    try {
      iframe.contentWindow.print();
    } catch (e) {
      showToast('Impossible d\'imprimer', 'warn');
    }
  });
  const newOpenBtn = openBtn.cloneNode(true);
  openBtn.parentNode.replaceChild(newOpenBtn, openBtn);
  newOpenBtn.addEventListener('click', () => {
    window.open(url, '_blank');
  });
  const escHandler = function(e) {
    if (e.key === 'Escape' && modal.style.display === 'block') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}
function updateDetailModalTitle() {
  const piste = state.filtered[state.currentIndex];
  if (piste) {
    document.getElementById('detail-modal-title').textContent = 
      `Fiche détaillée - Piste ${piste.numero}`;
  }
}
function toggleRex(header) {
  const content = header.nextElementSibling;
  const icon = header.querySelector('.rex-toggle');
  if (content.style.maxHeight) {
    content.style.maxHeight = null;
    icon.style.transform = 'rotate(0deg)';
  } else {
    content.style.maxHeight = content.scrollHeight + 'px';
    icon.style.transform = 'rotate(180deg)';
  }
}
function displayRex(piste) {
  const rexContainer = document.getElementById('rex-container');
  const rexList = document.getElementById('rex-list');
  const rexCount = document.getElementById('rex-count');
  if (!piste.retours_experience || piste.retours_experience.length === 0) {
    rexContainer.style.display = 'none';
    return;
  }
  rexContainer.style.display = 'block';
  rexCount.textContent = piste.retours_experience.length;
  rexList.innerHTML = '';
  piste.retours_experience.forEach((rex, index) => {
    const item = document.createElement('div');
    item.className = 'rex-item';
    const header = document.createElement('div');
    header.className = 'rex-item-header';
    header.onclick = function() { toggleRex(this); };
    header.innerHTML = `
      <i class="fa-solid fa-building"></i>
      <span class="rex-item-societe">${rex.societe}</span>
      <!--span class="rex-item-badge">${rex.resultats?.length || 0} résultats</span-->
      <i class="fa-solid fa-chevron-down rex-toggle"></i>
    `;
    const content = document.createElement('div');
    content.className = 'rex-item-content';
    let contentHtml = '<div>';
    if (rex.ce_qui_existe && rex.ce_qui_existe.length > 0) {
      contentHtml += `
        <div class="rex-subsection">
          <div class="rex-subtitle">
            <i class="fa-solid fa-check-circle"></i>
            Ce qui existe
          </div>
          <ul class="rex-list-items">
            ${rex.ce_qui_existe.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    if (rex.resultats && rex.resultats.length > 0) {
      contentHtml += `
        <div class="rex-subsection">
          <div class="rex-subtitle">
            <i class="fa-solid fa-trophy"></i>
            Résultats
          </div>
          <ul class="rex-list-items resultats">
            ${rex.resultats.map(res => `<li>${res}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    if (rex.lecon) {
      contentHtml += `
        <div class="rex-subsection">
          <div class="rex-subtitle">
            <i class="fa-solid fa-lightbulb"></i>
            Leçon
          </div>
          <div class="rex-lecon">
            "${rex.lecon}"
          </div>
        </div>
      `;
    }
    if (rex.justificatifs && rex.justificatifs.length > 0) {
      contentHtml += `
        <div class="rex-subsection">
          <div class="rex-subtitle">
            <i class="fa-solid fa-link"></i>
            Sources
          </div>
          <div class="rex-justificatifs">
            ${rex.justificatifs.map(j => `
              <a href="${j.url}" target="_blank" class="rex-url">
                <i class="fa-solid fa-arrow-up-right-from-squares"></i>
                ${j.titre || j.url}
              </a>
            `).join('')}
          </div>
        </div>
      `;
    }
    contentHtml += '</div>';
    content.innerHTML = contentHtml;
    item.appendChild(header);
    item.appendChild(content);
    rexList.appendChild(item);
  });
}
function closeAllRex() {
  document.querySelectorAll('.rex-item-content').forEach(content => {
    content.style.maxHeight = null;
  });
  document.querySelectorAll('.rex-toggle').forEach(icon => {
    icon.style.transform = 'rotate(0deg)';
  });
}
function openRex(index) {
  const items = document.querySelectorAll('.rex-item');
  if (items[index]) {
    const header = items[index].querySelector('.rex-item-header');
    toggleRex(header);
  }
}
function displaySummary(piste) {
  const summaryContainer = document.getElementById('summary-container');
  const summaryContent = document.getElementById('summary-content');
  if (!piste.en_resume) {
    summaryContainer.style.display = 'none';
    return;
  }
  summaryContainer.style.display = 'block';
  summaryContent.innerHTML = piste.en_resume;
}
function displayJustificatifs(piste) {
  const justificatifsContainer = document.getElementById('justificatifs-container');
  const justificatifsList = document.getElementById('justificatifs-list');
  if (!justificatifsContainer || !justificatifsList) return;
  if (!piste.justificatifs || piste.justificatifs.length === 0) {
    justificatifsContainer.style.display = 'none';
    justificatifsList.innerHTML = '';
    return;
  }
  justificatifsContainer.style.display = 'block';
  justificatifsList.innerHTML = piste.justificatifs.map(justificatif => `
    <div class="justificatif-item">
      <div class="justificatif-societe">
        <i class="fa-solid fa-building"></i>
        <span>${justificatif.societe || 'Source'}</span>
      </div>
      ${justificatif.description ? `<div class="justificatif-description">${justificatif.description}</div>` : ''}
      ${justificatif.url ? `
        <a href="${justificatif.url}" target="_blank" rel="noopener noreferrer" class="justificatif-url">
          <i class="fa-solid fa-up-right-from-square"></i>
          <span>${justificatif.url}</span>
        </a>
      ` : ''}
    </div>
  `).join('');
}
let syntheseCurrentView = 'grid'; 
function getShortDescription(piste) {
 if (piste.description) {
    const text = piste.description.replace(/<[^>]*>/g, '');
    return text.length > 120 ? text.substring(0, 120) + '…' : text;
  }
  if (piste.en_resume) {
    const text = piste.en_resume.replace(/<[^>]*>/g, '');
    return text.length > 120 ? text.substring(0, 120) + '…' : text;
  }
  if (piste.conviction) {
    return piste.conviction.length > 120 ? piste.conviction.substring(0, 120) + '…' : piste.conviction;
  }
   return "Description détaillée disponible dans la fiche.";
}
function getPrioClass(prio) {
  const map = { 'Quick Win': 'qw', 'Stratégique': 'st', 'Complémentaire': 'cp', 'Long Terme': 'lt' };
  return map[prio] || '';
}
function filterPistesForSynthese() {
  const search = document.getElementById('synthese-search').value.toLowerCase();
  const priority = document.getElementById('synthese-priority').value;
  const category = document.getElementById('synthese-category').value;
  const activePistes = getActivePistes();
  return activePistes.filter(p => {
    const matchesSearch = p.titre.toLowerCase().includes(search) ||
                          (p.slogan && p.slogan.toLowerCase().includes(search)) ||
                          p.categorie.toLowerCase().includes(search);
    const matchesPriority = !priority || p.priorite === priority;
    const matchesCategory = !category || p.categorie === category;
    return matchesSearch && matchesPriority && matchesCategory;
  });
}
function renderSyntheseGrid(pistes) {
  const container = document.getElementById('synthese-grid');
  container.innerHTML = '';
  pistes.forEach(p => {
    const card = document.createElement('div');
    card.className = 'piste-card';
    card.dataset.numero = p.numero;
    const prioClass = getPrioClass(p.priorite);
    const shortDesc = getShortDescription(p);
    card.innerHTML = `
      <div class="piste-card-header">
        <span class="piste-card-numero">PISTE ${p.numero}</span>
        <span class="piste-card-prio ${prioClass}">${p.priorite}</span>
        <span class="piste-card-cat">${p.categorie}</span>
      </div>
      <div class="piste-card-body">
        <div class="piste-card-titre">${p.titre}</div>
        ${p.slogan ? `<div class="piste-card-slogan">${p.slogan}</div>` : ''}
        <div class="piste-card-desc">${shortDesc}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      document.getElementById('synthese-modal').style.display = 'none';
      document.body.style.overflow = '';
      const filteredIndex = state.filtered.findIndex(fp => fp.numero === p.numero);
      if (filteredIndex >= 0) {
        selectTrack(filteredIndex);
      } else {
        state.filterText = '';
        state.filterPriority = '';
        state.filterCategory = '';
        state.filterRating = 0;
        document.getElementById('search-input').value = '';
        document.getElementById('priority-filter').value = '';
        document.getElementById('category-filter').value = '';
        document.getElementById('rating-filter').value = '0';
        applyFilters();
        const newIndex = state.filtered.findIndex(fp => fp.numero === p.numero);
        if (newIndex >= 0) selectTrack(newIndex);
      }
    });
    container.appendChild(card);
  });
  document.getElementById('synthese-count').textContent = `${pistes.length} piste${pistes.length > 1 ? 's' : ''}`;
}
function renderSyntheseList(pistes) {
  const container = document.getElementById('synthese-list');
  container.innerHTML = '';
  pistes.forEach(p => {
    const item = document.createElement('div');
    item.className = 'piste-list-item';
    item.dataset.numero = p.numero;
    const prioClass = getPrioClass(p.priorite);
    item.innerHTML = `
      <span class="piste-list-numero">#${p.numero}</span>
      <span class="piste-list-titre">${p.titre}</span>
      <span class="piste-list-slogan">${p.slogan || ''}</span>
      <span class="piste-list-prio piste-card-prio ${prioClass}">${p.priorite}</span>
    `;
    item.addEventListener('click', () => {
      document.getElementById('synthese-modal').style.display = 'none';
      document.body.style.overflow = '';
      const filteredIndex = state.filtered.findIndex(fp => fp.numero === p.numero);
      if (filteredIndex >= 0) {
        selectTrack(filteredIndex);
      } else {
        state.filterText = '';
        state.filterPriority = '';
        state.filterCategory = '';
        state.filterRating = 0;
        document.getElementById('search-input').value = '';
        document.getElementById('priority-filter').value = '';
        document.getElementById('category-filter').value = '';
        document.getElementById('rating-filter').value = '0';
        applyFilters();
        const newIndex = state.filtered.findIndex(fp => fp.numero === p.numero);
        if (newIndex >= 0) selectTrack(newIndex);
      }
    });
    container.appendChild(item);
  });
  document.getElementById('synthese-count').textContent = `${pistes.length} piste${pistes.length > 1 ? 's' : ''}`;
}
function updateSyntheseDisplay() {
  const filtered = filterPistesForSynthese();
  const activeCount = getActivePistes().length;
  document.getElementById('synthese-total-pistes-modale').textContent = activeCount;
  document.getElementById('synthese-active-count').textContent = activeCount;
  if (syntheseCurrentView === 'grid') {
    document.getElementById('synthese-grid').style.display = 'grid';
    document.getElementById('synthese-list').style.display = 'none';
    renderSyntheseGrid(filtered);
  } else {
    document.getElementById('synthese-grid').style.display = 'none';
    document.getElementById('synthese-list').style.display = 'flex';
    renderSyntheseList(filtered);
  }
}
function initSyntheseModal() {
  const modal = document.getElementById('synthese-modal');
  const openBtn = document.getElementById('btn-synthese');
  const closeBtn = document.getElementById('synthese-close');
  const viewGridBtn = document.getElementById('synthese-view-grid');
  const viewListBtn = document.getElementById('synthese-view-list');
  const searchInput = document.getElementById('synthese-search');
  const prioritySelect = document.getElementById('synthese-priority');
  const categorySelect = document.getElementById('synthese-category');
  openBtn.addEventListener('click', () => {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    updateSyntheseDisplay();
  });
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  });
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'block') {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  });
  viewGridBtn.addEventListener('click', () => {
    syntheseCurrentView = 'grid';
    viewGridBtn.style.color = 'var(--c-primary)';
    viewListBtn.style.color = 'var(--c-text-muted)';
    updateSyntheseDisplay();
  });
  viewListBtn.addEventListener('click', () => {
    syntheseCurrentView = 'list';
    viewListBtn.style.color = 'var(--c-primary)';
    viewGridBtn.style.color = 'var(--c-text-muted)';
    updateSyntheseDisplay();
  });
  searchInput.addEventListener('input', updateSyntheseDisplay);
  prioritySelect.addEventListener('change', updateSyntheseDisplay);
  categorySelect.addEventListener('change', updateSyntheseDisplay);
}
function updateTotalCout() {
  const cout2026 = parseFloat(document.getElementById('q-cout-2026').value) || 0;
  const cout2027 = parseFloat(document.getElementById('q-cout-2027').value) || 0;
  const cout2028 = parseFloat(document.getElementById('q-cout-2028').value) || 0;
  const total = cout2026 + cout2027 + cout2028;
  document.getElementById('q-cout-3-ans').value = total ? formatNumber(total) + ' €' : '0 €';
  return total;
}
function updateDelaiRange(val) {
  document.getElementById('delai-json-val').textContent = val + ' m';
  document.getElementById('delai-json-display').textContent = val + ' mois';
}
function setupStarInput(inputId, starsId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('input', () => {
    updateInputStars(inputId, starsId);
  });
}
function updateInputStars(inputId, starsId) {
  const input = document.getElementById(inputId);
  const starsContainer = document.getElementById(starsId);
  if (!input || !starsContainer) return;
  let val = parseInt(input.value, 10) || 0;
  if (val < 0) val = 0;
  if (val > 5) val = 5;
  input.value = val;
  let starsHtml = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= val) {
      starsHtml += '<i class="fa-solid fa-star" style="color: var(--c-star);"></i>';
    } else {
      starsHtml += '<i class="fa-regular fa-star" style="color: var(--c-star-empty);"></i>';
    }
  }
  starsContainer.innerHTML = starsHtml;
}
setTimeout(() => {
  if (state.pistes.length > 0) {
    initSyntheseModal();
  }
}, 500);
let currentMatrixFilter = 'all';
let currentMatrixSearch = '';
let showBidirectionalOnly = false;
function getRelationIconAndColor(type) {
  const icons = {
    'prerequisite': { icon: 'fa-solid fa-arrow-right', color: '#d97706', label: 'Prérequis' },
    'synergy': { icon: 'fa-solid fa-handshake', color: '#059669', label: 'Synergie' },
    'feeds_data': { icon: 'fa-solid fa-database', color: '#2563eb', label: 'Fournit données' },
    'process_flow': { icon: 'fa-solid fa-diagram-next', color: '#7c3aed', label: 'Processus' },
    'conflict': { icon: 'fa-solid fa-circle-exclamation', color: '#dc2626', label: 'Conflit' },
    'neutral': { icon: 'fa-solid fa-circle', color: '#9ca3af', label: 'Indépendant' }
  };
  return icons[type] || { icon: 'fa-solid fa-circle', color: '#9ca3af', label: 'Indépendant' };
}
function getTypeDescription(type) {
  const descriptions = {
    'prerequisite': 'La piste source est un prérequis nécessaire à la réalisation de la piste cible. Elle doit être mise en œuvre avant.',
    'synergy': 'Les deux pistes fonctionnent en synergie. Leur mise en œuvre conjointe produit des bénéfices supérieurs à la somme des bénéfices individuels.',
    'feeds_data': 'La piste source fournit des données essentielles au fonctionnement ou à l\'évaluation de la piste cible.',
    'process_flow': 'Les deux pistes s\'inscrivent dans un même processus. La piste source précède logiquement la piste cible dans le déroulement des opérations.',
    'conflict': 'Attention : il existe un risque de conflit ou de redondance entre ces deux pistes. Une attention particulière est nécessaire lors de leur mise en œuvre conjointe.',
    'neutral': 'Les deux pistes sont indépendantes. Aucune interaction particulière n\'a été identifiée entre elles.'
  };
  return descriptions[type] || 'Relation non spécifiée.';
}
function buildProfessionalTooltip(sourceNum, targetNum, relation, pistes) {
  const sourcePiste = pistes.find(p => p.numero === sourceNum);
  const targetPiste = pistes.find(p => p.numero === targetNum);
  if (!sourcePiste || !targetPiste) return '';
  const type = relation ? relation.type : 'neutral';
  const { icon, color, label } = getRelationIconAndColor(type);
  const description = getTypeDescription(type);
  let html = `
    <div class="matrix-tooltip">
      <div class="tooltip-header">
        <i class="${icon}" style="color: ${color};"></i>
        <span>Relation ${label}</span>
      </div>
      <div class="tooltip-content">
        <div class="tooltip-piste">
          <div class="tooltip-piste-source">
            <span class="tooltip-piste-num">P${sourceNum}</span>
            <span class="tooltip-piste-title">${sourcePiste.titre}</span>
          </div>
          <div class="tooltip-arrow">
            <i class="fa-solid fa-arrow-right" style="color: ${color};"></i>
          </div>
          <div class="tooltip-piste-target">
            <span class="tooltip-piste-num">P${targetNum}</span>
            <span class="tooltip-piste-title">${targetPiste.titre}</span>
          </div>
        </div>
  `;
  if (relation && relation.reason) {
    html += `
      <div class="tooltip-reason">
        <i class="fa-solid fa-quote-left"></i>
        ${relation.reason}
      </div>
    `;
  } else {
    html += `
      <div class="tooltip-reason neutral">
        <i class="fa-solid fa-circle-info"></i>
        ${description}
      </div>
    `;
  }
  html += `
    <div class="tooltip-meta">
      <div class="tooltip-meta-item">
        <span class="meta-label">Priorité source :</span>
        <span class="meta-value priority-${sourcePiste.priorite?.toLowerCase().replace(' ', '-')}">${sourcePiste.priorite || 'Non définie'}</span>
      </div>
      <div class="tooltip-meta-item">
        <span class="meta-label">Priorité cible :</span>
        <span class="meta-value priority-${targetPiste.priorite?.toLowerCase().replace(' ', '-')}">${targetPiste.priorite || 'Non définie'}</span>
      </div>
      <div class="tooltip-meta-item">
        <span class="meta-label">Score source :</span>
        <span class="meta-value">${sourcePiste.rating || 0} ⭐</span>
      </div>
      <div class="tooltip-meta-item">
        <span class="meta-label">Score cible :</span>
        <span class="meta-value">${targetPiste.rating || 0} ⭐</span>
      </div>
    </div>
  `;
  const reverseRelation = sourcePiste.relations?.find(r => r.target === sourceNum);
  if (reverseRelation) {
    html += `
      <div class="tooltip-bidirectional">
        <i class="fa-solid fa-arrow-right-arrow-left" style="color: ${color};"></i>
        Relation bidirectionnelle détectée
      </div>
    `;
  }
  html += `</div></div>`;
  return html;
}
function filterPistesBySearch(numeros, pistes) {
  if (!currentMatrixSearch) return numeros;
  const searchLower = currentMatrixSearch.toLowerCase();
  return numeros.filter(num => {
    const piste = pistes.find(p => p.numero === num);
    return num.includes(searchLower) || 
           piste.titre.toLowerCase().includes(searchLower) ||
           (piste.slogan && piste.slogan.toLowerCase().includes(searchLower));
  });
}
function buildFilteredRelationsMatrix() {
  const pistes = getActivePistes();
  if (pistes.length === 0) {
    return '<div class="empty-state"><i class="fa-solid fa-diagram-project"></i><p>Aucune piste active sélectionnée</p></div>';
  }
  let numeros = pistes.map(p => p.numero).sort((a, b) => parseInt(a) - parseInt(b));
  numeros = filterPistesBySearch(numeros, pistes);
  if (numeros.length === 0) {
    return '<div class="empty-state"><i class="fa-solid fa-search"></i><p>Aucune piste ne correspond à votre recherche</p></div>';
  }
  const relationsMap = {};
  pistes.forEach(p => {
    relationsMap[p.numero] = {};
    if (p.relations) {
      p.relations.forEach(r => {
        if (pistes.some(activeP => activeP.numero === r.target)) {
          relationsMap[p.numero][r.target] = r;
        }
      });
    }
  });
  let html = '<table class="relations-matrix">';
  html += '<thead><tr><th>Piste</th>';
  numeros.forEach(num => {
    const piste = pistes.find(p => p.numero === num);
    html += `<th class="matrix-header-cell" data-numero="${num}" title="${piste.titre}">${num}</th>`;
  });
  html += '</tr></thead><tbody>';
  numeros.forEach(sourceNum => {
    const sourcePiste = pistes.find(p => p.numero === sourceNum);
    let rowHtml = '<tr>';
    rowHtml += `<td class="matrix-source" data-numero="${sourceNum}" title="${sourcePiste.titre}">
                  <strong>${sourceNum}</strong>
                  <span class="matrix-source-title">${sourcePiste.titre.substring(0, 25)}${sourcePiste.titre.length > 25 ? '…' : ''}</span>
                </td>`;
    numeros.forEach(targetNum => {
      if (sourceNum === targetNum) {
        rowHtml += '<td class="matrix-cell diagonal"><i class="fa-solid fa-minus"></i></td>';
      } else {
        const relation = relationsMap[sourceNum]?.[targetNum];
        const type = relation ? relation.type : 'neutral';
        if (currentMatrixFilter !== 'all' && type !== currentMatrixFilter) {
          rowHtml += '<td class="matrix-cell filtered-out"></td>';
          return;
        }
        if (showBidirectionalOnly) {
          const reverseRelation = relationsMap[targetNum]?.[sourceNum];
          if (!reverseRelation || type === 'neutral') {
            rowHtml += '<td class="matrix-cell filtered-out"></td>';
            return;
          }
        }
        const { icon, color } = getRelationIconAndColor(type);
        const isBidirectional = relationsMap[targetNum]?.[sourceNum];
        const tooltip = buildProfessionalTooltip(sourceNum, targetNum, relation, pistes);
        rowHtml += `<td class="matrix-cell ${type}" 
                       style="background-color: ${color}20; border-left-color: ${color};"
                       data-tooltip='${tooltip.replace(/'/g, "&apos;")}'
                       data-source="${sourceNum}"
                       data-target="${targetNum}"
                       data-type="${type}">`;
        rowHtml += `<i class="${icon}" style="color: ${color};"></i>`;
        if (isBidirectional && type !== 'neutral') {
          rowHtml += '<i class="fa-solid fa-arrow-right-arrow-left bidirectional" style="color: ' + color + ';"></i>';
        }
        rowHtml += '</td>';
      }
    });
    rowHtml += '</tr>';
    html += rowHtml;
  });
  html += '</tbody></table>';
  return html;
}
function updateMatrixStats() {
  const pistes = getActivePistes();
  if (pistes.length === 0) {
    return;
  }
  const numeros = pistes.map(p => p.numero);
  const relationsMap = {};
  pistes.forEach(p => {
    relationsMap[p.numero] = {};
    if (p.relations) {
      p.relations.forEach(r => {
        if (pistes.some(activeP => activeP.numero === r.target)) {
          relationsMap[p.numero][r.target] = r;
        }
      });
    }
  });
  const stats = {
    prerequisite: 0, 
    synergy: 0, 
    feeds_data: 0,
    process_flow: 0, 
    conflict: 0, 
    neutral: 0, 
    bidirectional: 0
  };
  const countedPairs = new Set();
  numeros.forEach(source => {
    numeros.forEach(target => {
      if (source === target) return;
      const pairKey = [source, target].sort().join('-');
      if (countedPairs.has(pairKey)) return;
      countedPairs.add(pairKey);
      const relation = relationsMap[source]?.[target];
      const reverseRelation = relationsMap[target]?.[source];
      if (relation) {
        stats[relation.type] = (stats[relation.type] || 0) + 1;
        if (reverseRelation) stats.bidirectional++;
      } else if (!reverseRelation) {
        stats.neutral++;
      }
    });
  });
  updateMatrixHeaderStats(pistes.length, countedPairs.size);
}
function updateMatrixHeaderStats(activeCount, totalPairs) {
  const modalTitle = document.querySelector('#relations-matrix-modal .modal-title');
  if (modalTitle) {
    let indicator = document.getElementById('matrix-active-indicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.id = 'matrix-active-indicator';
      indicator.style.marginLeft = '10px';
      indicator.style.fontSize = '0.7rem';
      indicator.style.background = 'var(--c-primary-light)';
      indicator.style.padding = '2px 8px';
      indicator.style.borderRadius = '12px';
      indicator.style.color = 'var(--c-primary)';
      modalTitle.appendChild(indicator);
    }
    indicator.textContent = `${activeCount} pistes actives • ${totalPairs} relations`;
  }
}
function refreshMatrix() {
  const container = document.getElementById('relations-matrix-container');
  if (container) {
    const pistes = getActivePistes();
    if (pistes.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-diagram-project"></i><p>Aucune piste active. Veuillez en sélectionner dans la modale de sélection.</p></div>';
      updateMatrixHeaderStats(0, 0);
      return;
    }
    container.innerHTML = buildFilteredRelationsMatrix();
    updateMatrixStats();
    enableMatrixTooltips();
  }
}
function enableMatrixTooltips() {
  const tooltipElements = document.querySelectorAll('[data-tooltip]');
  tooltipElements.forEach(el => {
    el.addEventListener('mouseenter', (e) => {
      const tooltipText = el.dataset.tooltip;
      const tooltip = document.createElement('div');
      tooltip.className = 'matrix-tooltip-popup';
      tooltip.innerHTML = tooltipText;
      tooltip.style.position = 'fixed';
      tooltip.style.zIndex = '10000';
      document.body.appendChild(tooltip);
      const rect = el.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
      let top = rect.top - tooltipRect.height - 10;
      if (left < 10) left = 10;
      if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
      }
      if (top < 10) {
        top = rect.bottom + 10;
        tooltip.classList.add('bottom');
      }
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
      el._tooltip = tooltip;
    });
    el.addEventListener('mouseleave', () => {
      if (el._tooltip) {
        el._tooltip.remove();
        el._tooltip = null;
      }
    });
  });
}
function initRelationsMatrixModal() {
  const modal = document.getElementById('relations-matrix-modal');
  const openBtn = document.getElementById('btn-relations');
  const closeBtn = document.getElementById('matrix-close');
  const exportBtn = document.getElementById('matrix-export');
  const searchInput = document.getElementById('matrix-search');
  const showBidirectionalCheck = document.getElementById('matrix-show-bidirectional');
  const filterButtons = document.querySelectorAll('.filter-btn');
  function addScrollIndicator(container) {
      const indicator = document.createElement('div');
      indicator.className = 'scroll-indicator';
      indicator.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right"></i> Utilisez les barres de défilement';
      container.appendChild(indicator);
      setTimeout(() => {
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 1000);
      }, 3000);
    }
  if (!modal || !openBtn) return;
  openBtn.addEventListener('click', () => {
    currentMatrixFilter = 'all';
    currentMatrixSearch = '';
    showBidirectionalOnly = false;
    if (searchInput) searchInput.value = '';
    if (showBidirectionalCheck) showBidirectionalCheck.checked = false;
    filterButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === 'all');
    });
    refreshMatrix();
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  });
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  });
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'block') {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  });
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMatrixFilter = btn.dataset.filter;
      refreshMatrix();
    });
  });
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentMatrixSearch = e.target.value;
      refreshMatrix();
    });
  }
  if (showBidirectionalCheck) {
    showBidirectionalCheck.addEventListener('change', (e) => {
      showBidirectionalOnly = e.target.checked;
      refreshMatrix();
    });
  }
  const refreshBtn = document.getElementById('matrix-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshMatrix();
      showToast('Matrice mise à jour avec la sélection actuelle', 'success');
    });
  }
  exportBtn.addEventListener('click', () => {
    exportRelationsMatrixToCSV();
  });
}
function exportRelationsMatrixToCSV() {
  const pistes = getActivePistes();
  if (pistes.length === 0) {
    showToast('Aucune piste active à exporter', 'warn');
    return;
  }
  const numeros = pistes.map(p => p.numero).sort((a, b) => parseInt(a) - parseInt(b));
  const relationsMap = {};
  pistes.forEach(p => {
    relationsMap[p.numero] = {};
    if (p.relations) {
      p.relations.forEach(r => {
        if (pistes.some(activeP => activeP.numero === r.target)) {
          relationsMap[p.numero][r.target] = r.type;
        }
      });
    }
  });
  let csv = 'Source;' + numeros.join(';') + '\n';
  numeros.forEach(source => {
    const sourcePiste = pistes.find(p => p.numero === source);
    csv += `"${source} - ${sourcePiste.titre}"`;
    numeros.forEach(target => {
      if (source === target) {
        csv += ';"-"';
      } else {
        const type = relationsMap[source]?.[target] || 'neutral';
        csv += ';"' + type + '"';
      }
    });
    csv += '\n';
  });
  csv += '\n\nLÉGENDE DES TYPES DE RELATION\n';
  csv += 'prerequisite;Prérequis;La piste source est nécessaire à la piste cible\n';
  csv += 'synergy;Synergie;Effet multiplicateur quand mises en œuvre ensemble\n';
  csv += 'feeds_data;Fournit des données;La piste source alimente la piste cible en données\n';
  csv += 'process_flow;Processus;La piste source précède logiquement la piste cible\n';
  csv += 'conflict;Conflit;Attention nécessaire à la mise en œuvre conjointe\n';
  csv += 'neutral;Indépendant;Aucune relation particulière\n';
  csv += `\n# Basé sur ${pistes.length} pistes actives\n`;
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relations_matrix_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Matrice exportée au format CSV avec légende', 'success');
}
let decisionMatrixSort = { column: 'global', direction: 'desc' };
let decisionMatrixFilters = {
  priority: '',
  category: '',
  search: '',
  onlyScored: false
};
function calculateGlobalScore(piste) {
  const weights = {
    cout: 0.25,        
    delai: 0.15,       
    impact: 0.25,      
    faisabilite: 0.15, 
    acceptabilite: 0.10, 
    score: 0.10        
  };
  const activePistes = getActivePistes();
  const maxCout = Math.max(...activePistes.map(p => p.cout_3_ans || 0), 1);
  const coutNorm = maxCout > 0 ? 1 - ((piste.cout_3_ans || 0) / maxCout) : 0;
  const maxDelai = Math.max(...activePistes.map(p => p.delai_mois || 6), 1);
  const delaiNorm = maxDelai > 0 ? 1 - ((piste.delai_mois || 6) / maxDelai) : 0;
  const impact = (piste.niveau_impact || 0) / 5;
  const faisabilite = (piste.niveau_faisabilite || 0) / 5;
  const acceptabilite = (piste.niveau_acceptabilite || 0) / 5;
  const score = (piste.rating || 0) / 5;
  const globalScore = (
    coutNorm * weights.cout +
    delaiNorm * weights.delai +
    impact * weights.impact +
    faisabilite * weights.faisabilite +
    acceptabilite * weights.acceptabilite +
    score * weights.score
  ) * 100;
  return Math.round(globalScore);
}
function getGlobalScoreClass(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'bon';
  if (score >= 40) return 'moyen';
  return 'faible';
}
function getScoreClass(value) {
  if (value >= 4) return 'score-high';
  if (value >= 3) return 'score-medium';
  return 'score-low';
}
function filterPistesForDecisionMatrix() {
  const activePistes = getActivePistes();
  return activePistes.filter(p => {
    if (decisionMatrixFilters.priority && p.priorite !== decisionMatrixFilters.priority) return false;
    if (decisionMatrixFilters.category && p.categorie !== decisionMatrixFilters.category) return false;
    if (decisionMatrixFilters.search) {
      const searchLower = decisionMatrixFilters.search.toLowerCase();
      const matchesNumero = p.numero.toLowerCase().includes(searchLower);
      const matchesTitre = p.titre.toLowerCase().includes(searchLower);
      if (!matchesNumero && !matchesTitre) return false;
    }
    if (decisionMatrixFilters.onlyScored && (!p.rating || p.rating === 0)) return false;
    return true;
  });
}
function sortPistesForMatrix(pistes) {
  const sorted = [...pistes];
  sorted.sort((a, b) => {
    let valA, valB;
    switch(decisionMatrixSort.column) {
      case 'numero':
        valA = parseInt(a.numero);
        valB = parseInt(b.numero);
        break;
      case 'titre':
        valA = a.titre;
        valB = b.titre;
        break;
      case 'priorite':
        const priorityOrder = { 'Quick Win': 1, 'Stratégique': 2, 'Complémentaire': 3, 'Long Terme': 4 };
        valA = priorityOrder[a.priorite] || 5;
        valB = priorityOrder[b.priorite] || 5;
        break;
      case 'cout':
        valA = a.cout_3_ans || 0;
        valB = b.cout_3_ans || 0;
        break;
      case 'delai':
        valA = a.delai_mois || 6;
        valB = b.delai_mois || 6;
        break;
      case 'impact':
        valA = a.niveau_impact || 0;
        valB = b.niveau_impact || 0;
        break;
      case 'faisabilite':
        valA = a.niveau_faisabilite || 0;
        valB = b.niveau_faisabilite || 0;
        break;
      case 'acceptabilite':
        valA = a.niveau_acceptabilite || 0;
        valB = b.niveau_acceptabilite || 0;
        break;
      case 'score':
        valA = a.rating || 0;
        valB = b.rating || 0;
        break;
      case 'global':
        valA = calculateGlobalScore(a);
        valB = calculateGlobalScore(b);
        break;
      default:
        valA = calculateGlobalScore(a);
        valB = calculateGlobalScore(b);
    }
    if (valA < valB) return decisionMatrixSort.direction === 'asc' ? -1 : 1;
    if (valA > valB) return decisionMatrixSort.direction === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}
function buildDecisionMatrix() {
  const container = document.getElementById('decision-matrix-container');
  if (!container) return;
  const pistes = filterPistesForDecisionMatrix();
  const sortedPistes = sortPistesForMatrix(pistes);
  if (sortedPistes.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-table"></i><p>Aucune piste ne correspond aux critères</p></div>';
    updateDecisionMatrixStats([]);
    return;
  }
  let html = `
    <table class="decision-matrix">
      <thead>
        <tr>
          <th onclick="sortDecisionMatrix('titre')">
            Piste / Titre
            ${decisionMatrixSort.column === 'titre' ? `<i class="fa-solid fa-chevron-${decisionMatrixSort.direction === 'asc' ? 'up' : 'down'}"></i>` : '<i class="fa-solid fa-sort"></i>'}
          </th>
          <th onclick="sortDecisionMatrix('priorite')">
            Priorité
            ${decisionMatrixSort.column === 'priorite' ? `<i class="fa-solid fa-chevron-${decisionMatrixSort.direction === 'asc' ? 'up' : 'down'}"></i>` : '<i class="fa-solid fa-sort"></i>'}
          </th>
          <th onclick="sortDecisionMatrix('cout')">
            Coût (M€)
            ${decisionMatrixSort.column === 'cout' ? `<i class="fa-solid fa-chevron-${decisionMatrixSort.direction === 'asc' ? 'up' : 'down'}"></i>` : '<i class="fa-solid fa-sort"></i>'}
          </th>
          <th onclick="sortDecisionMatrix('delai')">
            Délai (mois)
            ${decisionMatrixSort.column === 'delai' ? `<i class="fa-solid fa-chevron-${decisionMatrixSort.direction === 'asc' ? 'up' : 'down'}"></i>` : '<i class="fa-solid fa-sort"></i>'}
          </th>
          <th onclick="sortDecisionMatrix('impact')">
            Impact
            ${decisionMatrixSort.column === 'impact' ? `<i class="fa-solid fa-chevron-${decisionMatrixSort.direction === 'asc' ? 'up' : 'down'}"></i>` : '<i class="fa-solid fa-sort"></i>'}
          </th>
          <th onclick="sortDecisionMatrix('faisabilite')">
            Faisabilité
            ${decisionMatrixSort.column === 'faisabilite' ? `<i class="fa-solid fa-chevron-${decisionMatrixSort.direction === 'asc' ? 'up' : 'down'}"></i>` : '<i class="fa-solid fa-sort"></i>'}
          </th>
          <th onclick="sortDecisionMatrix('acceptabilite')">
            Acceptabilité
            ${decisionMatrixSort.column === 'acceptabilite' ? `<i class="fa-solid fa-chevron-${decisionMatrixSort.direction === 'asc' ? 'up' : 'down'}"></i>` : '<i class="fa-solid fa-sort"></i>'}
          </th>
          <th onclick="sortDecisionMatrix('score')">
            Notation
            ${decisionMatrixSort.column === 'score' ? `<i class="fa-solid fa-chevron-${decisionMatrixSort.direction === 'asc' ? 'up' : 'down'}"></i>` : '<i class="fa-solid fa-sort"></i>'}
          </th>
          <th onclick="sortDecisionMatrix('global')">
            Score Global
            ${decisionMatrixSort.column === 'global' ? `<i class="fa-solid fa-chevron-${decisionMatrixSort.direction === 'asc' ? 'up' : 'down'}"></i>` : '<i class="fa-solid fa-sort"></i>'}
          </th>
        </tr>
      </thead>
      <tbody>
  `;
  sortedPistes.forEach(p => {
    const cout = ((p.cout_3_ans || 0) / 1000000).toFixed(2);
    const delai = p.delai_mois || 6;
    const impact = p.niveau_impact || 0;
    const faisabilite = p.niveau_faisabilite || 0;
    const acceptabilite = p.niveau_acceptabilite || 0;
    const score = p.rating || 0;
    const globalScore = calculateGlobalScore(p);
    let priorityClass = '';
    switch(p.priorite) {
      case 'Quick Win': priorityClass = 'qw'; break;
      case 'Stratégique': priorityClass = 'st'; break;
      case 'Complémentaire': priorityClass = 'cp'; break;
      case 'Long Terme': priorityClass = 'lt'; break;
    }
    html += `
      <tr onclick="selectTrackFromMatrix('${p.numero}')">
        <td>
          <span class="piste-numero">#${p.numero}</span>
          ${p.titre}
        </td>
        <td>
          <span class="priority-badge-mini ${priorityClass}">${p.priorite}</span>
        </td>
        <td class="score-cell ${getScoreClass(5 - Math.min(5, Math.floor(cout/2)))}">
          ${cout}
          <div class="progress-bar-mini">
            <div class="progress-bar-mini-fill" style="width: ${Math.min(100, (parseFloat(cout)/10)*100)}%; background: #2563eb;"></div>
          </div>
        </td>
        <td class="score-cell ${getScoreClass(5 - Math.min(5, Math.floor(delai/12)))}">
          ${delai}
          <div class="progress-bar-mini">
            <div class="progress-bar-mini-fill" style="width: ${Math.min(100, (delai/60)*100)}%; background: #d97706;"></div>
          </div>
        </td>
        <td class="score-cell ${getScoreClass(impact)}">
          ${impact}/5
          <div class="progress-bar-mini">
            <div class="progress-bar-mini-fill" style="width: ${(impact/5)*100}%; background: #059669;"></div>
          </div>
        </td>
        <td class="score-cell ${getScoreClass(faisabilite)}">
          ${faisabilite}/5
          <div class="progress-bar-mini">
            <div class="progress-bar-mini-fill" style="width: ${(faisabilite/5)*100}%; background: #7c3aed;"></div>
          </div>
        </td>
        <td class="score-cell ${getScoreClass(acceptabilite)}">
          ${acceptabilite}/5
          <div class="progress-bar-mini">
            <div class="progress-bar-mini-fill" style="width: ${(acceptabilite/5)*100}%; background: #f59e0b;"></div>
          </div>
        </td>
        <td class="score-cell ${getScoreClass(score)}">
          ${score}/5
          <div class="progress-bar-mini">
            <div class="progress-bar-mini-fill" style="width: ${(score/5)*100}%; background: #1a56db;"></div>
          </div>
        </td>
        <td class="global-score ${getGlobalScoreClass(globalScore)}">
          ${globalScore}
          ${globalScore >= 70 ? '<span class="trend-indicator trend-up"></span>' : globalScore <= 30 ? '<span class="trend-indicator trend-down"></span>' : ''}
        </td>
      </tr>
    `;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
  updateDecisionMatrixStats(sortedPistes);
}
function updateDecisionMatrixStats(pistes) {
  const statsContainer = document.getElementById('decision-matrix-stats');
  if (!statsContainer) return;
  const activeCount = getActivePistes().length;
  document.getElementById('matrix-piste-count').textContent = 
    `${pistes.length} piste${pistes.length > 1 ? 's' : ''} affichée${pistes.length > 1 ? 's' : ''} sur ${activeCount} active${activeCount > 1 ? 's' : ''}`;
  if (pistes.length === 0) {
    statsContainer.innerHTML = '<div class="stat-item">Aucune donnée</div>';
    return;
  }
  document.getElementById('matrix-active-count').textContent = activeCount;
  const moyCout = (pistes.reduce((sum, p) => sum + (p.cout_3_ans || 0), 0) / pistes.length / 1000000).toFixed(2);
  const moyDelai = (pistes.reduce((sum, p) => sum + (p.delai_mois || 6), 0) / pistes.length).toFixed(1);
  const moyImpact = (pistes.reduce((sum, p) => sum + (p.niveau_impact || 0), 0) / pistes.length).toFixed(1);
  const moyGlobal = (pistes.reduce((sum, p) => sum + calculateGlobalScore(p), 0) / pistes.length).toFixed(0);
  const qwCount = pistes.filter(p => p.priorite === 'Quick Win').length;
  const stCount = pistes.filter(p => p.priorite === 'Stratégique').length;
  const cpCount = pistes.filter(p => p.priorite === 'Complémentaire').length;
  const ltCount = pistes.filter(p => p.priorite === 'Long Terme').length;
  statsContainer.innerHTML = `
    <div class="stat-item">
      <span class="stat-label">Coût moy.</span>
      <span class="stat-value">${moyCout} M€</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Délai moy.</span>
      <span class="stat-value">${moyDelai} mois</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Impact moy.</span>
      <span class="stat-value">${moyImpact}/5</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Score global</span>
      <span class="stat-value ${getGlobalScoreClass(parseInt(moyGlobal))}">${moyGlobal}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Quick Wins</span>
      <span class="stat-value" style="color: #059669;">${qwCount}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Stratégiques</span>
      <span class="stat-value" style="color: #d97706;">${stCount}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Complémentaires</span>
      <span class="stat-value" style="color: #2563eb;">${cpCount}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Long Terme</span>
      <span class="stat-value" style="color: #7c3aed;">${ltCount}</span>
    </div>
  `;
}
function sortDecisionMatrix(column) {
  if (decisionMatrixSort.column === column) {
    decisionMatrixSort.direction = decisionMatrixSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    decisionMatrixSort.column = column;
    decisionMatrixSort.direction = 'desc';
  }
  buildDecisionMatrix();
}
function selectTrackFromMatrix(numero) {
  const filteredIndex = state.filtered.findIndex(p => p.numero === numero);
  if (filteredIndex >= 0) {
    selectTrack(filteredIndex);
    document.getElementById('decision-matrix-modal').style.display = 'none';
    document.body.style.overflow = '';
  } else {
    state.filterText = '';
    state.filterPriority = '';
    state.filterCategory = '';
    state.filterRating = 0;
    document.getElementById('search-input').value = '';
    document.getElementById('priority-filter').value = '';
    document.getElementById('category-filter').value = '';
    document.getElementById('rating-filter').value = '0';
    applyFilters();
    const newIndex = state.filtered.findIndex(p => p.numero === numero);
    if (newIndex >= 0) {
      selectTrack(newIndex);
      document.getElementById('decision-matrix-modal').style.display = 'none';
      document.body.style.overflow = '';
    }
  }
}
function exportDecisionMatrixToCSV() {
  const pistes = filterPistesForDecisionMatrix();
  const sortedPistes = sortPistesForMatrix(pistes);
  if (sortedPistes.length === 0) {
    showToast('Aucune donnée à exporter', 'warn');
    return;
  }
  let csv = 'Numéro;Titre;Priorité;Catégorie;Coût (M€);Délai (mois);Impact;Faisabilité;Acceptabilité;Score;Score Global\n';
  sortedPistes.forEach(p => {
    const cout = ((p.cout_3_ans || 0) / 1000000).toFixed(2);
    const delai = p.delai_mois || 6;
    const impact = p.niveau_impact || 0;
    const faisabilite = p.niveau_faisabilite || 0;
    const acceptabilite = p.niveau_acceptabilite || 0;
    const score = p.rating || 0;
    const globalScore = calculateGlobalScore(p);
    csv += `"${p.numero}";"${p.titre}";"${p.priorite}";"${p.categorie}";${cout};${delai};${impact};${faisabilite};${acceptabilite};${score};${globalScore}\n`;
  });
  csv += '\n# LÉGENDE DES SCORES GLOBAUX\n';
  csv += '# 80-100: Excellent (vert) | 60-79: Bon (bleu) | 40-59: Moyen (orange) | 0-39: Faible (rouge)\n';
  csv += '# Pondération: Coût 25% (inversé), Délai 15% (inversé), Impact 25%, Faisabilité 15%, Acceptabilité 10%, Score 10%\n';
  csv += `# Basé sur ${getActivePistes().length} pistes actives\n`;
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `matrice_de_decision_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Matrice exportée au format CSV', 'success');
}
function initDecisionMatrixModal() {
  const modal = document.getElementById('decision-matrix-modal');
  const openBtn = document.getElementById('btn-matrice');
  const closeBtn = document.getElementById('matrix-decision-close');
  const exportBtn = document.getElementById('matrix-decision-export');
  const searchInput = document.getElementById('matrix-decision-search');
  const prioritySelect = document.getElementById('matrix-decision-priority');
  const categorySelect = document.getElementById('matrix-decision-category');
  const onlyScoredCheck = document.getElementById('matrix-show-only-scored');
  if (!modal || !openBtn) return;
  openBtn.addEventListener('click', () => {
    decisionMatrixFilters = {
      priority: '',
      category: '',
      search: '',
      onlyScored: false
    };
    if (searchInput) searchInput.value = '';
    if (prioritySelect) prioritySelect.value = '';
    if (categorySelect) categorySelect.value = '';
    if (onlyScoredCheck) onlyScoredCheck.checked = false;
    decisionMatrixSort = { column: 'global', direction: 'desc' };
    buildDecisionMatrix();
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  });
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  });
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'block') {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  });
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      decisionMatrixFilters.search = e.target.value;
      buildDecisionMatrix();
    });
  }
  if (prioritySelect) {
    prioritySelect.addEventListener('change', (e) => {
      decisionMatrixFilters.priority = e.target.value;
      buildDecisionMatrix();
    });
  }
  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      decisionMatrixFilters.category = e.target.value;
      buildDecisionMatrix();
    });
  }
  if (onlyScoredCheck) {
    onlyScoredCheck.addEventListener('change', (e) => {
      decisionMatrixFilters.onlyScored = e.target.checked;
      buildDecisionMatrix();
    });
  }
  exportBtn.addEventListener('click', exportDecisionMatrixToCSV);
}
function initEditionTabLayout() {
  const editionContainer = document.getElementById('tab-edition-content');
  const sideElement = document.getElementById('edition-layout') || document.querySelector('.edition-layout');
  const mainElement = document.querySelector('.main');
  if (!editionContainer || !sideElement || !mainElement) return;
  if (sideElement.parentElement !== editionContainer) {
    editionContainer.appendChild(sideElement);
  }
  sideElement.style.display = 'flex';
  sideElement.style.width = '100%';
  mainElement.style.gridTemplateColumns = '1fr';
}
let currentPisteTab = 'image';
function initPisteTabs() {
  const tabs = document.querySelectorAll('.piste-tab');
  const imgElement = document.getElementById('piste-image');
  const containers = {
    'image': document.getElementById('tab-image-content'),
    'edition': document.getElementById('tab-edition-content'),
    'synthese': document.getElementById('tab-synthese-content'),
    'details': document.getElementById('tab-details-content'),
    'references': document.getElementById('tab-references-content'),
    'relations': document.getElementById('tab-relations-content'),
    'risques': document.getElementById('tab-risques-content'),
    'radar': document.getElementById('tab-radar-content')
  };
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      Object.values(containers).forEach(c => c.style.display = 'none');
      const tabName = tab.dataset.tab;
      currentPisteTab = tabName;
      if (containers[tabName]) {
        containers[tabName].style.display = 'block';
      }
      if (state.currentIndex >= 0 && state.filtered[state.currentIndex]) {
        const piste = state.filtered[state.currentIndex];
        if (tabName === 'image') {
          updatePisteImage(piste);
        } else if (tabName === 'edition') {
          setTimeout(() => {
            updateEditionTab(piste);
          }, 0);
        } else if (tabName === 'synthese') {
          updatePisteSynthese(piste);
        } else if (tabName === 'details') {
          updatePisteDetails(piste);
        } else if (tabName === 'references') {
          updatePisteReferences(piste);
        } else if (tabName === 'risques') {
          updatePisteRisques(piste);
        } else if (tabName === 'relations') {
          displayRelations(piste);
        } else if (tabName === 'radar') {
          initRadarChart();
        }
      }
    });
  });
  document.getElementById('btn-show-image')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchPisteTab('image');
  });
  document.getElementById('btn-show-synthese')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchPisteTab('synthese');
  });
  document.getElementById('btn-show-details')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchPisteTab('details');
  });
  imgElement?.addEventListener('dblclick', async () => {
    if (!imgElement.src || imgElement.style.display === 'none') return;
    if (!document.fullscreenElement && imgElement.requestFullscreen) {
      try {
        await imgElement.requestFullscreen();
      } catch (error) {
        showToast('Impossible de passer l’image en plein écran', 'warn');
      }
    }
  });
}
function switchPisteTab(tabName) {
  const tab = document.querySelector(`.piste-tab[data-tab="${tabName}"]`);
  if (tab) {
    tab.click();
  }
}
function updatePisteImage(piste) {
  const imgElement = document.getElementById('piste-image');
  const noImageMsg = document.getElementById('no-image-message');
  if (piste && piste.image) {
    imgElement.src = piste.image;
    imgElement.style.display = 'block';
    imgElement.title = 'Double-cliquez pour afficher en plein écran';
    noImageMsg.style.display = 'none';
  } else {
    imgElement.style.display = 'none';
    noImageMsg.style.display = 'block';
    noImageMsg.textContent = '🛫 Aucune image disponible';
  }
}
function updatePisteSynthese(piste) {
  const descElement = document.getElementById('card-desc');
  if (descElement) {
    descElement.innerHTML = piste.description_details || piste.description || 'Aucun détail disponible pour cette piste.';
  }
  const convictionContainer = document.getElementById('conviction-container');
  const convictionContent = document.getElementById('conviction-content');
  if (piste.conviction) {
    convictionContainer.style.display = 'block';
    convictionContent.textContent = piste.conviction;
  } else {
    convictionContainer.style.display = 'none';
  }
  const propositionsContainer = document.getElementById('propositions-container');
  const propositionsList = document.getElementById('propositions-list');
  if (piste.propositions && piste.propositions.length > 0) {
    propositionsContainer.style.display = 'block';
    propositionsList.innerHTML = '';
    piste.propositions.forEach(prop => {
      const li = document.createElement('li');
      li.textContent = prop;
      propositionsList.appendChild(li);
    });
  } else {
    propositionsContainer.style.display = 'none';
  }
  displaySummary(piste);
}
function updatePisteDetails(piste) {
  const iframe = document.getElementById('details-content-iframe');
  const emptyState = document.getElementById('details-frame-empty');
  const title = document.getElementById('details-frame-title');
  const openLink = document.getElementById('details-frame-open');
  if (!iframe || !emptyState || !title || !openLink) return;
  if (!piste) {
    iframe.src = '';
    iframe.style.display = 'none';
    emptyState.style.display = 'block';
    title.textContent = 'Fiche détaillée';
    openLink.href = '#';
    return;
  }
  const url = `pistes/piste${piste.numero}.html`;
  title.textContent = `Piste ${piste.numero} : ${piste.titre}`;
  openLink.href = url;
  emptyState.style.display = 'none';
  iframe.style.display = 'block';
  iframe.src = url;
  iframe.onload = () => {
    emptyState.style.display = 'none';
    iframe.style.display = 'block';
  };
  iframe.onerror = () => {
    iframe.src = '';
    iframe.style.display = 'none';
    emptyState.style.display = 'block';
  };
}
function updatePisteReferences(piste) {
  const iframe = document.getElementById('references-content-iframe');
  const emptyState = document.getElementById('references-frame-empty');
  const title = document.getElementById('references-frame-title');
  const openLink = document.getElementById('references-frame-open');
  if (!iframe || !emptyState || !title || !openLink) return;
  if (!piste) {
    iframe.src = '';
    iframe.style.display = 'none';
    emptyState.style.display = 'block';
    title.textContent = 'Fiche references';
    openLink.href = '#';
    return;
  }
  const url = `references/piste${piste.numero}.html`;
  title.textContent = `Piste ${piste.numero} : ${piste.titre}`;
  openLink.href = url;
  emptyState.style.display = 'none';
  iframe.style.display = 'block';
  iframe.src = url;
  iframe.onload = () => {
    emptyState.style.display = 'none';
    iframe.style.display = 'block';
  };
  iframe.onerror = () => {
    iframe.src = '';
    iframe.style.display = 'none';
    emptyState.style.display = 'block';
  };
}
function updatePisteRisques(piste) {
  const iframe = document.getElementById('risques-content-iframe');
  const emptyState = document.getElementById('risques-frame-empty');
  const title = document.getElementById('risques-frame-title');
  const openLink = document.getElementById('risques-frame-open');
  if (!iframe || !emptyState || !title || !openLink) return;
  if (!piste) {
    iframe.src = '';
    iframe.style.display = 'none';
    emptyState.style.display = 'block';
    title.textContent = 'Fiche risque';
    openLink.href = '#';
    return;
  }
  const url = `risques/piste${piste.numero}.html`;
  title.textContent = `Piste ${piste.numero} : ${piste.titre}`;
  openLink.href = url;
  emptyState.style.display = 'none';
  iframe.style.display = 'block';
  iframe.src = url;
  iframe.onload = () => {
    emptyState.style.display = 'none';
    iframe.style.display = 'block';
  };
  iframe.onerror = () => {
    iframe.src = '';
    iframe.style.display = 'none';
    emptyState.style.display = 'block';
  };
}
function setupChartTabs() {
  if (chartTabsInitialized) return;
  chartTabsInitialized = true;
  const tabs = document.querySelectorAll('.chart-tab');
  const containers = {
    'scores': document.getElementById('chart-scores'),
    'histogram': document.getElementById('chart-histogram'),
    'bubble': document.getElementById('chart-bubble'),
    'triangle': document.getElementById('chart-triangle')  
  };
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      Object.values(containers).forEach(c => c.style.display = 'none');
      const tabName = tab.dataset.tab;
      if (containers[tabName]) {
        containers[tabName].style.display = 'block';
        setTimeout(() => {
          switch(tabName) {
            case 'histogram':
              if (histogramChart) histogramChart.update();
              else initHistogramChart();
              break;
            case 'bubble':
              if (bubbleChart) bubbleChart.update();
              else initBubbleChart();
              break;
            case 'scores':
              if (scoresChart) scoresChart.update();
              break;
            case 'triangle':
              initTriangleChart();
              break;
          }
        }, 50);
      }
    });
  });
}
function normalizeValues(pistes) {
  const maxCout = Math.max(...pistes.map(p => p.cout_3_ans || 0), 1);
  const maxDelai = Math.max(...pistes.map(p => p.delai_mois || 6), 1);
  const maxImpact = 5; 
  return pistes.map(p => {
    const coutNorm = 1 - ((p.cout_3_ans || 0) / maxCout);
    const delaiNorm = 1 - ((p.delai_mois || 6) / maxDelai);
    const impactNorm = (p.niveau_impact || 0) / maxImpact;
    const sum = coutNorm + delaiNorm + impactNorm;
    if (sum === 0) return { x: 0.33, y: 0.33, cout: 0, delai: 0, impact: 0 };
    const x = (delaiNorm / sum) * 0.8 + 0.1; 
    const y = (coutNorm / sum) * 0.7 + 0.15; 
    return {
      x: x,
      y: y,
      coutNorm: coutNorm / sum,
      delaiNorm: delaiNorm / sum,
      impactNorm: impactNorm / sum,
      coutReel: (p.cout_3_ans || 0) / 1000000,
      delaiReel: p.delai_mois || 6,
      impactReel: p.niveau_impact || 0,
      equilibre: calculateEquilibre(coutNorm / sum, delaiNorm / sum, impactNorm / sum),
      ...p
    };
  });
}
function calculateEquilibre(c, d, i) {
  const ideal = 1/3;
  const ecart = Math.abs(c - ideal) + Math.abs(d - ideal) + Math.abs(i - ideal);
  return Math.max(0, 1 - ecart);
}
function normalizeTriangleValues(pistes) {
  const maxCout = Math.max(...pistes.map(p => p.cout_3_ans || 0), 1);
  const maxDelai = Math.max(...pistes.map(p => p.delai_mois || 6), 1);
  return pistes.map(p => {
    const coutNorm = 1 - ((p.cout_3_ans || 0) / maxCout);
    const delaiNorm = 1 - ((p.delai_mois || 6) / maxDelai);
    const impactNorm = (p.niveau_impact || 0) / 5;
    const sum = coutNorm + delaiNorm + impactNorm;
    if (sum === 0) {
      return {
        x: 0.5,
        y: 0.2887,
        coutNorm: 0,
        delaiNorm: 0,
        impactNorm: 0,
        coutReel: (p.cout_3_ans || 0) / 1000000,
        delaiReel: p.delai_mois || 6,
        impactReel: p.niveau_impact || 0,
        equilibre: 0,
        ...p
      };
    }
    const coutPart = coutNorm / sum;
    const delaiPart = delaiNorm / sum;
    const impactPart = impactNorm / sum;
    return {
      x: delaiPart + (impactPart * 0.5),
      y: impactPart * 0.866,
      coutNorm: coutPart,
      delaiNorm: delaiPart,
      impactNorm: impactPart,
      coutReel: (p.cout_3_ans || 0) / 1000000,
      delaiReel: p.delai_mois || 6,
      impactReel: p.niveau_impact || 0,
      equilibre: calculateEquilibre(coutPart, delaiPart, impactPart),
      ...p
    };
  });
}
function getPriorityColor(priorite) {
  switch(priorite) {
    case 'Quick Win': return '#059669';
    case 'Stratégique': return '#d97706';
    case 'Complémentaire': return '#2563eb';
    case 'Long Terme': return '#7c3aed';
    default: return '#9ca3af';
  }
}
function initTriangleChart() {
  const canvas = document.getElementById('triangle-chart');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  if (canvas) {
    canvas.style.width = '100%';
    canvas.style.height = '340px';
    canvas.width = canvas.offsetWidth || 600;
    canvas.height = 340;
  }
  if (triangleChart) triangleChart.destroy();
  const pistes = state.filtered;
  if (pistes.length === 0) return;
  const normalizedData = normalizeTriangleValues(pistes).map(p => ({
    ...p,
    pertinence: calculateGlobalScore(p)
  }));
  const bestPoint = normalizedData.reduce((best, current) => (
    !best || current.pertinence > best.pertinence ? current : best
  ), null);
  const selectedNumero = state.filtered[state.currentIndex]?.numero;
  const datasets = [
    { label: 'Quick Win', data: [], backgroundColor: '#059669', borderColor: '#059669' },
    { label: 'Stratégique', data: [], backgroundColor: '#d97706', borderColor: '#d97706' },
    { label: 'Complémentaire', data: [], backgroundColor: '#2563eb', borderColor: '#2563eb' },
    { label: 'Long Terme', data: [], backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
    { label: 'Autres', data: [], backgroundColor: '#9ca3af', borderColor: '#9ca3af' }
  ];
  const positionedData = spreadTrianglePoints(normalizedData);
  positionedData.forEach(p => {
    const pointSize = 4 + (p.equilibre * 4);
    const point = {
      x: p.plotX,
      y: p.plotY,
      r: pointSize,
      equilibre: p.equilibre,
      pertinence: p.pertinence,
      cout: p.coutReel,
      delai: p.delaiReel,
      impact: p.impactReel,
      numero: p.numero,
      titre: p.titre,
      priorite: p.priorite,
      categorie: p.categorie,
      coutNorm: p.coutNorm,
      delaiNorm: p.delaiNorm,
      impactNorm: p.impactNorm,
      isBest: bestPoint?.numero === p.numero,
      isSelected: selectedNumero === p.numero
    };
    switch(p.priorite) {
      case 'Quick Win': datasets[0].data.push(point); break;
      case 'Stratégique': datasets[1].data.push(point); break;
      case 'Complémentaire': datasets[2].data.push(point); break;
      case 'Long Terme': datasets[3].data.push(point); break;
      default: datasets[4].data.push(point);
    }
  });
  const activeDatasets = datasets.filter(d => d.data.length > 0);
  const triangleBackgroundPlugin = {
    id: 'triangleBackground',
    beforeDatasetsDraw(chart) {
      drawTriangleGuide(chart.ctx, chart.chartArea);
    },
    afterDatasetsDraw(chart) {
    }
  };
  triangleChart = new Chart(ctx, {
    type: 'scatter',
    data: { datasets: activeDatasets },
    plugins: [triangleBackgroundPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      hover: { animationDuration: 0 },
      plugins: {
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context) {
              const point = context.raw;
              const equilibrePercent = Math.round(point.equilibre * 100);
              return [
                `Piste ${point.numero}: ${point.titre}`,
                ` Coût: ${point.cout.toFixed(2)} M€ (${Math.round(point.coutNorm * 100)}%)`,
                ` Délai: ${point.delai} mois (${Math.round(point.delaiNorm * 100)}%)`,
                ` Impact: ${point.impact}/5 (${Math.round(point.impactNorm * 100)}%)`,
                ` Équilibre: ${equilibrePercent}%`,
                ` Pertinence: ${point.pertinence}/100`,
                ` Priorité: ${point.priorite}`
              ];
            }
          },
          backgroundColor: '#1f2937',
          titleColor: '#ffffff',
          bodyColor: '#e5e7eb'
        },
        legend: { display: false },
      },
      scales: {
        x: { 
          display: false,
          min: 0,
          max: 1
        },
        y: { 
          display: false,
          min: 0,
          max: 0.9
        }
      },
      elements: {
        point: {
          radius(context) {
            const point = context.raw;
            if (!point) return 5;
            if (point.isSelected) return point.r + 2;
            if (point.isBest) return point.r + 1;
            return point.r;
          },
          borderWidth(context) {
            const point = context.raw;
            if (!point) return 1;
            if (point.isSelected) return 3;
            if (point.isBest) return 2;
            return 1;
          },
          borderColor(context) {
            const point = context.raw;
            if (!point) return '#ffffff';
            if (point.isSelected) return '#111827';
            if (point.isBest) return '#f59e0b';
            return 'rgba(255, 255, 255, 0.85)';
          },
          backgroundColor(context) {
            const point = context.raw;
            if (!point) return 'rgba(148, 163, 184, 0.7)';
            const base = getPriorityColor(point.priorite);
            return hexToRgba(base, point.isSelected || point.isBest ? 0.95 : 0.72);
          },
          hoverRadius(context) {
            const point = context.raw;
            return (point?.r || 5) + 3;
          },
          hoverBorderWidth: 3,
          hoverBorderColor: '#111827'
        }
      },
      onClick: function(event, elements) {
        if (elements && elements.length > 0) {
          const element = elements[0];
          const point = element.raw;
          const filteredIndex = state.filtered.findIndex(p => p.numero === point.numero);
          if (filteredIndex >= 0) {
            selectTrack(filteredIndex);
          }
        }
      }
    }
  });
  updateTriangleLegend(normalizedData);
}
function drawTriangleGuide(ctx, chartArea) {
  if (!chartArea) return;
  const { left, right, top, bottom, width, height } = chartArea;
  const padding = Math.min(width, height) * 0.08;
  const topX = left + width / 2;
  const topY = top + padding;
  const leftX = left + padding;
  const leftY = bottom - padding;
  const rightX = right - padding;
  const rightY = bottom - padding;
  const centerX = (topX + leftX + rightX) / 3;
  const centerY = (topY + leftY + rightY) / 3;
  ctx.save();
  ctx.strokeStyle = '#cfd6e6';
  ctx.lineWidth = 2;
  fillTriangleDecisionZones(ctx, {
    topX, topY, leftX, leftY, rightX, rightY, centerX, centerY
  });
  ctx.strokeStyle = '#dbe2f0';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (let i = 1; i < 3; i++) {
    const ratio = i / 3;
    const y = topY + (leftY - topY) * ratio;
    const startX = topX - (topX - leftX) * ratio;
    const endX = topX + (rightX - topX) * ratio;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = '#475569';
  ctx.font = '600 12px "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Impact', topX, topY - 10);
  ctx.textAlign = 'right';
  ctx.fillText('Coût', leftX - 8, leftY + 4);
  ctx.textAlign = 'left';
  ctx.fillText('Délai', rightX + 8, rightY + 4);
  ctx.restore();
}
function fillTriangleDecisionZones(ctx, coords) {
  const { topX, topY, leftX, leftY, rightX, rightY, centerX, centerY } = coords;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(leftX, leftY);
  ctx.lineTo(topX, topY);
  ctx.lineTo(rightX, rightY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(240, 242, 247, 0.42)';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((leftX + topX) / 2, (leftY + topY) / 2);
  ctx.lineTo((topX + rightX) / 2, (topY + rightY) / 2);
  ctx.lineTo(centerX, centerY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(34, 197, 94, 0.16)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(leftX, leftY);
  ctx.lineTo((leftX + topX) / 2, (leftY + topY) / 2);
  ctx.lineTo(centerX, centerY);
  ctx.lineTo((leftX + rightX) / 2, (leftY + rightY) / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo((topX + rightX) / 2, (topY + rightY) / 2);
  ctx.lineTo(rightX, rightY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(239, 68, 68, 0.11)';
  ctx.fill();
  ctx.font = '700 11px "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#166534';
  ctx.fillText('A privilegier', centerX, centerY - 8);
  ctx.fillStyle = '#b45309';
  ctx.fillText('A arbitrer', leftX + (rightX - leftX) * 0.34, leftY - 18);
  ctx.fillStyle = '#b91c1c';
  ctx.fillText('A eviter', rightX - 14, rightY - 18);
  ctx.restore();
}
function drawTriangleHighlights(chart) {
  const ctx = chart.ctx;
  ctx.save();
  ctx.font = '600 11px "DM Sans", sans-serif';
  ctx.textBaseline = 'bottom';
  chart.data.datasets.forEach((dataset, datasetIndex) => {
    const meta = chart.getDatasetMeta(datasetIndex);
    meta.data.forEach((element, index) => {
      const point = dataset.data[index];
      if (!point || (!point.isBest && !point.isSelected)) return;
      const { x, y } = element.getProps(['x', 'y'], true);
      const label = point.isSelected ? `Selection ${point.numero}` : `Top ${point.numero}`;
      ctx.fillStyle = point.isSelected ? '#111827' : '#b45309';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - (point.r + 10));
    });
  });
  ctx.restore();
}
function spreadTrianglePoints(points) {
  const groups = new Map();
  points.forEach(point => {
    const key = `${Math.round(point.x * 24)}-${Math.round(point.y * 24)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(point);
  });
  groups.forEach(group => {
    if (group.length === 1) {
      group[0].plotX = group[0].x;
      group[0].plotY = group[0].y;
      return;
    }
    group.forEach((point, index) => {
      const angle = (Math.PI * 2 * index) / group.length;
      const radius = Math.min(0.018 + (Math.floor(index / 6) * 0.008), 0.04);
      point.plotX = clamp(point.x + (Math.cos(angle) * radius), 0.04, 0.96);
      point.plotY = clamp(point.y + (Math.sin(angle) * radius), 0.04, 0.84);
    });
  });
  return points;
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function hexToRgba(hex, alpha) {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized;
  const intValue = parseInt(expanded, 16);
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function drawTriangleBackground(ctx, width, height) {
  const padding = 20;
  const topX = width / 2;
  const topY = padding;
  const leftX = padding;
  const leftY = height - padding;
  const rightX = width - padding;
  const rightY = height - padding;
  ctx.save();
  ctx.strokeStyle = '#e2e5ef';
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(leftX, leftY);
  ctx.lineTo(topX, topY);
  ctx.lineTo(rightX, rightY);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = 'rgba(240, 242, 247, 0.3)';
  ctx.fill();
  ctx.font = 'bold 10px "DM Sans", sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.textAlign = 'center';
  ctx.fillText('IMPACT ⬆', topX, topY - 5);
  ctx.textAlign = 'right';
  ctx.fillText('COÛT ⬆', leftX - 5, leftY);
  ctx.textAlign = 'left';
  ctx.fillText('DÉLAI ⬆', rightX + 5, rightY);
  ctx.strokeStyle = '#e2e5ef';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  for (let i = 1; i < 3; i++) {
    const ratio = i / 3;
    const y1 = topY + (leftY - topY) * ratio;
    const x1 = topX - (topX - leftX) * ratio;
    const x2 = topX + (rightX - topX) * ratio;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y1);
    ctx.stroke();
  }
  ctx.restore();
}
function updateTriangleLegend(data) {
  const legendContainer = document.getElementById('triangle-legend');
  if (!legendContainer) return;
  const tresEquilibre = data.filter(p => p.equilibre >= 0.8).length;
  const equilibre = data.filter(p => p.equilibre >= 0.6 && p.equilibre < 0.8).length;
  const desequilibre = data.filter(p => p.equilibre >= 0.4 && p.equilibre < 0.6).length;
  const tresDesequilibre = data.filter(p => p.equilibre < 0.4).length;
  const moyenneEquilibre = data.reduce((sum, p) => sum + p.equilibre, 0) / data.length;
  const topSolutions = [...data]
    .sort((a, b) => b.pertinence - a.pertinence)
    .slice(0, 3);
  const selectedNumero = state.filtered[state.currentIndex]?.numero;
  legendContainer.innerHTML = `
    <div class="triangle-explanation">
      Plus un point est proche d'un sommet, plus la piste favorise fortement ce critère. Pour comparer la pertinence, regarde d'abord le score de pertinence, puis vérifie si la piste reste équilibrée entre coût, délai et impact.
    </div>
    <div class="triangle-explanation triangle-explanation--accent">
      Fond vert = a privilegier, fond ambre = a arbitrer, fond rouge = a eviter. Anneau orange = meilleure pertinence. Anneau noir = piste actuellement sélectionnée.
    </div>
    <div class="triangle-stats">
      <div class="triangle-stat">
        <span class="triangle-stat-label">Équilibre moyen:</span>
        <span class="triangle-stat-value">${Math.round(moyenneEquilibre * 100)}%</span>
      </div>
      <div class="triangle-stat">
        <span class="triangle-stat-label">Très équilibré:</span>
        <span class="triangle-stat-value" style="color: #059669;">${tresEquilibre}</span>
      </div>
      <div class="triangle-stat">
        <span class="triangle-stat-label">Équilibré:</span>
        <span class="triangle-stat-value" style="color: #2563eb;">${equilibre}</span>
      </div>
      <div class="triangle-stat">
        <span class="triangle-stat-label">Déséquilibré:</span>
        <span class="triangle-stat-value" style="color: #d97706;">${desequilibre}</span>
      </div>
      <div class="triangle-stat">
        <span class="triangle-stat-label">Très déséquilibré:</span>
        <span class="triangle-stat-value" style="color: #dc2626;">${tresDesequilibre}</span>
      </div>
    </div>
    <div class="triangle-ranking">
      ${topSolutions.map((p, index) => `
        <button class="triangle-rank-card ${selectedNumero === p.numero ? 'is-selected' : ''}" type="button" onclick="focusTriangleTrack('${p.numero}')">
          <span class="triangle-rank-badge">#${index + 1}</span>
          <span class="triangle-rank-title">Piste ${p.numero}</span>
          <span class="triangle-rank-score">${p.pertinence}/100</span>
          <span class="triangle-rank-meta">Impact ${p.impactReel || 0}/5 · Délai ${p.delaiReel || 0} mois · Équilibre ${Math.round(p.equilibre * 100)}%</span>
        </button>
      `).join('')}
    </div>
  `;
}
function focusTriangleTrack(numero) {
  const filteredIndex = state.filtered.findIndex(p => String(p.numero) === String(numero));
  if (filteredIndex >= 0) {
    selectTrack(filteredIndex);
    initTriangleChart();
  }
}
function normalizeSelectionNumero(numero) {
  return String(numero);
}
function saveSelectionToStorage() {
  const selection = {
    selected: Array.from(state.selected).map(normalizeSelectionNumero),
    mode: state.selectionMode
  };
  localStorage.setItem('cdg2026_selection', JSON.stringify(selection));
}
function loadSelectionFromStorage() {
  const saved = localStorage.getItem('cdg2026_selection');
  if (saved) {
    try {
      const selection = JSON.parse(saved);
      state.selected = new Set((selection.selected || []).map(normalizeSelectionNumero));
      state.selectionMode = selection.mode || 'custom';
      state.excluded.clear();
      state.pistes.forEach(p => {
        const numero = normalizeSelectionNumero(p.numero);
        if (!state.selected.has(numero)) {
          state.excluded.add(p.numero);
        }
      });
      return true;
    } catch (e) {
      console.warn('Erreur chargement sélection', e);
    }
  }
  return false;
}
function initSelection() {
  if (!loadSelectionFromStorage()) {
    state.selected.clear();
    state.excluded.clear();
    state.pistes.forEach(p => state.selected.add(normalizeSelectionNumero(p.numero)));
    state.selectionMode = 'all';
    saveSelectionToStorage();
  }
  updateSelectionUI();
  updateSelectionSummary();
  applyFilters();
}
function updateSelection(selectedNumeros, mode = 'custom') {
  state.selected.clear();
  state.excluded.clear();
  selectedNumeros.forEach(num => state.selected.add(normalizeSelectionNumero(num)));
  state.pistes.forEach(p => {
    const numero = normalizeSelectionNumero(p.numero);
    if (!state.selected.has(numero)) {
      state.excluded.add(p.numero);
    }
  });
  state.selectionMode = mode;
  updateSelectionUI();
  updateSelectionSummary();
  applyFilters();
  saveSelectionToStorage();
  showToast(`${state.selected.size} pistes sélectionnées`, 'success');
}
function togglePisteSelection(numero) {
  const normalizedNumero = normalizeSelectionNumero(numero);
  if (state.selected.has(normalizedNumero)) {
    state.selected.delete(normalizedNumero);
    state.excluded.add(numero);
  } else {
    state.selected.add(normalizedNumero);
    state.excluded.delete(numero);
  }
  state.selectionMode = 'custom';
  updateSelectionUI();
  updateSelectionSummary();
  applyFilters();
  saveSelectionToStorage();
}
function selectAllPistes() {
  state.selected.clear();
  state.excluded.clear();
  state.pistes.forEach(p => state.selected.add(normalizeSelectionNumero(p.numero)));
  state.selectionMode = 'all';
  updateSelectionUI();
  updateSelectionSummary();
  applyFilters();
  saveSelectionToStorage();
  showToast('Toutes les pistes sélectionnées', 'success');
}
function deselectAllPistes() {
  state.selected.clear();
  state.excluded.clear();
  state.pistes.forEach(p => state.excluded.add(p.numero));
  state.selectionMode = 'none';
  updateSelectionUI();
  updateSelectionSummary();
  applyFilters();
  saveSelectionToStorage();
  showToast('Aucune piste sélectionnée', 'info');
}
function invertSelection() {
  const newSelected = new Set();
  state.pistes.forEach(p => {
    const numero = normalizeSelectionNumero(p.numero);
    if (!state.selected.has(numero)) {
      newSelected.add(numero);
    }
  });
  state.selected = newSelected;
  state.excluded.clear();
  state.pistes.forEach(p => {
    const numero = normalizeSelectionNumero(p.numero);
    if (!state.selected.has(numero)) {
      state.excluded.add(p.numero);
    }
  });
  state.selectionMode = 'custom';
  updateSelectionUI();
  updateSelectionSummary();
  applyFilters();
  saveSelectionToStorage();
  showToast('Sélection inversée', 'success');
}
function getActivePistes() {
  return state.pistes.filter(p => state.selected.has(normalizeSelectionNumero(p.numero)));
}
function applyFilters() {
  const txt = state.filterText.toLowerCase();
  const pri = state.filterPriority;
  const cat = state.filterCategory;
  const rat = state.filterRating;
  const activePistes = getActivePistes();
  state.filtered = activePistes.filter(p => {
    if (txt && !p.titre.toLowerCase().includes(txt)) return false;
    if (pri && p.priorite !== pri) return false;
    if (cat && p.categorie !== cat) return false;
    if (rat > 0) {
      if (rat === 5 && p.rating !== 5) return false;
      if (rat < 5 && p.rating < rat) return false;
    }
    return true;
  });
  const sel = document.getElementById('track-select');
  const prevPisteId = state.currentIndex >= 0 && state.filtered[state.currentIndex]
    ? state.filtered[state.currentIndex].numero : null;
  sel.innerHTML = '';
  if (state.filtered.length === 0) {
    sel.innerHTML = '<option value="">Aucune piste trouvée</option>';
    document.getElementById('card-num').textContent = 'PISTE #-';
    document.getElementById('card-title').textContent = 'Sélectionner une piste';
    document.getElementById('card-slogan').textContent = '-';
    document.getElementById('card-desc').textContent = 'Les détails de la piste apparaîtront ici après sélection.';
    document.getElementById('card-categorie').textContent = '-';
    document.getElementById('card-priorite').textContent = '-';
    state.currentIndex = -1;
  } else {
    state.filtered.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      const rated = p.rating > 0 ? ` ★${p.rating}` : '';
      opt.textContent = `${p.numero} - ${p.titre}${rated}`;
      sel.appendChild(opt);
    });
    let newIdx = 0;
    if (prevPisteId) {
      const found = state.filtered.findIndex(p => p.numero === prevPisteId);
      if (found >= 0) newIdx = found;
    }
    state.currentIndex = newIdx;
    sel.value = newIdx;
    loadCurrentTrack();
  }
  document.getElementById('filter-count').textContent = 
    `${state.filtered.length} piste${state.filtered.length !== 1 ? 's' : ''}`;
  initScoresChart();
  initHistogramChart();
  initBubbleChart();
  initTriangleChart();
  updateProgress();
  updateSelectionHeaderIndicator();
}
function updateSelectionHeaderIndicator() {
  const headerActions = document.querySelector('.header__actions');
  let indicator = document.getElementById('selection-header-indicator');
  if (!indicator) {
    indicator = document.createElement('span');
    indicator.id = 'selection-header-indicator';
    indicator.style.marginLeft = '5px';
    indicator.style.fontSize = '0.7rem';
    indicator.style.padding = '2px 6px';
    indicator.style.borderRadius = '12px';
    indicator.style.background = 'var(--c-primary-light)';
    indicator.style.color = 'var(--c-primary)';
    indicator.style.fontWeight = '600';
    const selectionBtn = document.getElementById('btn-selection');
    if (selectionBtn && selectionBtn.parentNode) {
      selectionBtn.parentNode.insertBefore(indicator, selectionBtn.nextSibling);
    }
  }
  const total = state.pistes.length;
  const selected = state.selected.size;
  if (selected === total) {
    indicator.textContent = 'Toutes';
    indicator.style.background = 'rgba(5, 150, 105, 0.1)';
    indicator.style.color = '#059669';
  } else if (selected === 0) {
    indicator.textContent = 'Aucune';
    indicator.style.background = 'rgba(220, 38, 38, 0.1)';
    indicator.style.color = '#dc2626';
  } else {
    indicator.textContent = `${selected}/${total}`;
    indicator.style.background = 'rgba(217, 119, 6, 0.1)';
    indicator.style.color = '#d97706';
  }
}
function updateSelectionUI() {
  const searchTerm = document.getElementById('selection-search')?.value.toLowerCase() || '';
  const priorityFilter = document.getElementById('selection-priority-filter')?.value || '';
  const categoryFilter = document.getElementById('selection-category-filter')?.value || '';
  const filteredPistes = state.pistes.filter(p => {
    if (searchTerm && !p.titre.toLowerCase().includes(searchTerm) && !p.numero.toLowerCase().includes(searchTerm)) return false;
    if (priorityFilter && p.priorite !== priorityFilter) return false;
    if (categoryFilter && p.categorie !== categoryFilter) return false;
    return true;
  });
  const tbody = document.getElementById('selection-list-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  filteredPistes.forEach(p => {
    const row = document.createElement('tr');
    row.dataset.numero = p.numero;
    const isSelected = state.selected.has(normalizeSelectionNumero(p.numero));
    const isExcluded = state.excluded.has(p.numero);
    if (isSelected) row.classList.add('selection-row-selected');
    if (isExcluded) row.classList.add('selection-row-excluded');
    let priorityClass = '';
    switch(p.priorite) {
      case 'Quick Win': priorityClass = 'qw'; break;
      case 'Stratégique': priorityClass = 'st'; break;
      case 'Complémentaire': priorityClass = 'cp'; break;
      case 'Long Terme': priorityClass = 'lt'; break;
    }
    const cout = ((p.cout_3_ans || 0) / 1000000).toFixed(2);
    row.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); togglePisteSelection('${p.numero}')">
      </td>
      <td><strong>#${p.numero}</strong></td>
      <td>${p.titre}</td>
      <td style="text-align: center;"><span class="selection-badge ${priorityClass}">${p.priorite}</span></td>
      <td style="text-align: center;">${p.categorie}</td>
      <td style="text-align: right;">${cout}</td>
      <td style="text-align: right;">${p.delai_mois || 6}</td>
      <td style="text-align: center;">${p.niveau_impact || 0}/5</td>
      <td style="text-align: center;">${p.rating || 0}⭐</td>
    `;
    row.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox') {
        const checkbox = row.querySelector('input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
        togglePisteSelection(p.numero);
      }
    });
    tbody.appendChild(row);
  });
  const headerCheckbox = document.getElementById('selection-header-checkbox');
  if (headerCheckbox) {
    const allVisibleSelected = filteredPistes.every(p => state.selected.has(normalizeSelectionNumero(p.numero)));
    const someVisibleSelected = filteredPistes.some(p => state.selected.has(normalizeSelectionNumero(p.numero)));
    headerCheckbox.checked = allVisibleSelected;
    headerCheckbox.indeterminate = !allVisibleSelected && someVisibleSelected;
  }
  updateSelectionCount(filteredPistes.length);
}
function updateSelectionCount(visibleCount) {
  const countEl = document.getElementById('selection-count');
  if (countEl) {
    countEl.textContent = `${state.selected.size}/${state.pistes.length} pistes sélectionnées`;
  }
}
function updateSelectionSummary() {
  const summaryEl = document.getElementById('selection-summary-stats');
  const budgetEl = document.getElementById('selection-budget-summary');
  const modeTextEl = document.getElementById('selection-mode-text');
  const modeIndicator = document.querySelector('.selection-mode-indicator');
  if (summaryEl) {
    summaryEl.textContent = `${state.selected.size} pistes sélectionnées sur ${state.pistes.length} totales`;
  }
  if (budgetEl) {
    const activePistes = getActivePistes();
    const budgetTotal = activePistes.reduce((sum, p) => sum + (p.cout_3_ans || 0), 0) / 1000000;
    budgetEl.textContent = `Budget total: ${budgetTotal.toFixed(2)} M€`;
  }
  if (modeTextEl) {
    switch(state.selectionMode) {
      case 'all':
        modeTextEl.textContent = 'Toutes les pistes';
        if (modeIndicator) {
          modeIndicator.className = 'selection-mode-indicator all';
        }
        break;
      case 'none':
        modeTextEl.textContent = 'Aucune piste';
        if (modeIndicator) {
          modeIndicator.className = 'selection-mode-indicator none';
        }
        break;
      default:
        modeTextEl.textContent = 'Mode personnalisé';
        if (modeIndicator) {
          modeIndicator.className = 'selection-mode-indicator custom';
        }
    }
  }
}
function initSelectionModal() {
  const modal = document.getElementById('selection-modal');
  const openBtn = document.getElementById('btn-selection');
  const closeBtn = document.getElementById('selection-close');
  const saveBtn = document.getElementById('selection-save');
  const selectAllBtn = document.getElementById('selection-select-all');
  const deselectAllBtn = document.getElementById('selection-deselect-all');
  const invertBtn = document.getElementById('selection-invert');
  const applyFiltersBtn = document.getElementById('selection-apply-filters');
  const searchInput = document.getElementById('selection-search');
  const priorityFilter = document.getElementById('selection-priority-filter');
  const categoryFilter = document.getElementById('selection-category-filter');
  const headerCheckbox = document.getElementById('selection-header-checkbox');
  if (!modal || !openBtn) return;
  openBtn.addEventListener('click', () => {
    updateSelectionUI();
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  });
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  });
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'block') {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  });
  saveBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    showToast('Sélection enregistrée', 'success');
  });
  selectAllBtn.addEventListener('click', selectAllPistes);
  deselectAllBtn.addEventListener('click', deselectAllPistes);
  invertBtn.addEventListener('click', invertSelection);
  applyFiltersBtn.addEventListener('click', () => {
    updateSelectionUI();
  });
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      updateSelectionUI();
    });
  }
  if (priorityFilter) {
    priorityFilter.addEventListener('change', () => {
      updateSelectionUI();
    });
  }
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      updateSelectionUI();
    });
  }
  if (headerCheckbox) {
    headerCheckbox.addEventListener('change', (e) => {
      const searchTerm = document.getElementById('selection-search')?.value.toLowerCase() || '';
      const priorityFilter = document.getElementById('selection-priority-filter')?.value || '';
      const categoryFilter = document.getElementById('selection-category-filter')?.value || '';
      const visiblePistes = state.pistes.filter(p => {
        if (searchTerm && !p.titre.toLowerCase().includes(searchTerm) && !p.numero.toLowerCase().includes(searchTerm)) return false;
        if (priorityFilter && p.priorite !== priorityFilter) return false;
        if (categoryFilter && p.categorie !== categoryFilter) return false;
        return true;
      });
        if (e.target.checked) {
          visiblePistes.forEach(p => state.selected.add(normalizeSelectionNumero(p.numero)));
          visiblePistes.forEach(p => state.excluded.delete(p.numero));
        } else {
          visiblePistes.forEach(p => state.selected.delete(normalizeSelectionNumero(p.numero)));
          visiblePistes.forEach(p => state.excluded.add(p.numero));
        }
       state.selectionMode = 'custom';
       updateSelectionUI();
       updateSelectionSummary();
       applyFilters();
       saveSelectionToStorage();
     });
   }
}
document.addEventListener('DOMContentLoaded', () => {
  loadExternalJSON();
});
