/**
 * QUANTUM CLASH - Card Game
 * MVP Version with Standard Model Particles
 */

// ========================================
// CARD DATABASE
// ========================================

const CARDS = {
    // КВАРКИ (Quarks) - Heavy hitters
    up_quark: {
        id: 'up_quark',
        name: 'Up Quark',
        type: 'unit',
        family: 'quark',
        cost: 1,
        attack: 2,
        health: 1,
        description: 'Самый лёгкий кварк. Быстрый удар.',
        emoji: '⬆️',
        effect: null
    },
    down_quark: {
        id: 'down_quark',
        name: 'Down Quark',
        type: 'unit',
        family: 'quark',
        cost: 1,
        attack: 1,
        health: 2,
        description: 'Стабильный строительный блок материи.',
        emoji: '⬇️',
        effect: null
    },
    charm_quark: {
        id: 'charm_quark',
        name: 'Charm Quark',
        type: 'unit',
        family: 'quark',
        cost: 3,
        attack: 4,
        health: 3,
        description: 'Очарованный кварк с зачаровывающей силой.',
        emoji: '✨',
        effect: null
    },
    strange_quark: {
        id: 'strange_quark',
        name: 'Strange Quark',
        type: 'unit',
        family: 'quark',
        cost: 2,
        attack: 3,
        health: 2,
        description: 'Странный кварк со странным очарованием.',
        emoji: '🔮',
        effect: null
    },
    top_quark: {
        id: 'top_quark',
        name: 'Top Quark',
        type: 'unit',
        family: 'quark',
        cost: 6,
        attack: 7,
        health: 6,
        description: 'Самый тяжёлый кварк! Разрушительная мощь.',
        emoji: '🏔️',
        effect: null
    },
    bottom_quark: {
        id: 'bottom_quark',
        name: 'Bottom Quark',
        type: 'unit',
        family: 'quark',
        cost: 4,
        attack: 5,
        health: 4,
        description: 'Прекрасный кварк с мощным ударом.',
        emoji: '🌟',
        effect: null
    },

    // ЛЕПТОНЫ (Leptons) - Utility and speed
    electron: {
        id: 'electron',
        name: 'Electron',
        type: 'unit',
        family: 'lepton',
        cost: 1,
        attack: 1,
        health: 2,
        description: 'Лёгкая частица, вращающаяся вокруг ядра.',
        emoji: '⚡',
        effect: null
    },
    electron_neutrino: {
        id: 'electron_neutrino',
        name: 'Electron Neutrino',
        type: 'unit',
        family: 'lepton',
        cost: 2,
        attack: 2,
        health: 1,
        description: 'Призрачная частица, проходит сквозь материю.',
        emoji: '👻',
        effect: 'stealth'
    },
    muon: {
        id: 'muon',
        name: 'Muon',
        type: 'unit',
        family: 'lepton',
        cost: 3,
        attack: 3,
        health: 4,
        description: 'Тяжёлый электрон. Живёт недолго, но силён.',
        emoji: '💫',
        effect: null
    },
    muon_neutrino: {
        id: 'muon_neutrino',
        name: 'Muon Neutrino',
        type: 'unit',
        family: 'lepton',
        cost: 3,
        attack: 2,
        health: 3,
        description: 'Нейтрино мюона. Мастер маскировки.',
        emoji: '🎭',
        effect: 'stealth'
    },
    tau: {
        id: 'tau',
        name: 'Tau Lepton',
        type: 'unit',
        family: 'lepton',
        cost: 5,
        attack: 5,
        health: 5,
        description: 'Самый тяжёлый лептон. Разрушительная сила.',
        emoji: '💥',
        effect: null
    },
    tau_neutrino: {
        id: 'tau_neutrino',
        name: 'Tau Neutrino',
        type: 'unit',
        family: 'lepton',
        cost: 4,
        attack: 3,
        health: 4,
        description: 'Нейтрино тау. Неуловимый призрак.',
        emoji: '🌙',
        effect: 'stealth'
    },

    // БОЗОНЫ (Bosons) - Spells and effects
    photon: {
        id: 'photon',
        name: 'Photon',
        type: 'spell',
        family: 'boson',
        cost: 2,
        attack: null,
        health: null,
        description: 'Наносит 3 урона любой цели.',
        emoji: '☀️',
        effect: 'damage',
        effectValue: 3
    },
    gluon: {
        id: 'gluon',
        name: 'Gluon',
        type: 'spell',
        family: 'boson',
        cost: 3,
        attack: null,
        health: null,
        description: 'Связывает всех существ на поле (+1/+1 всем).',
        emoji: '🔗',
        effect: 'buff_all',
        effectValue: 1
    },
    w_boson: {
        id: 'w_boson',
        name: 'W-Boson',
        type: 'spell',
        family: 'boson',
        cost: 4,
        attack: null,
        health: null,
        description: 'Слабое взаимодействие: 5 урона одной цели.',
        emoji: '🌊',
        effect: 'damage',
        effectValue: 5
    },
    z_boson: {
        id: 'z_boson',
        name: 'Z-Boson',
        type: 'unit',
        family: 'boson',
        cost: 5,
        attack: 4,
        health: 5,
        description: 'Нейтральный бозон. Даёт +1 атаки союзникам.',
        emoji: '⚖️',
        effect: 'aura_attack',
        effectValue: 1
    },
    higgs_boson: {
        id: 'higgs_boson',
        name: 'Higgs Boson',
        type: 'unit',
        family: 'boson',
        cost: 7,
        attack: 6,
        health: 7,
        description: 'Божественная частица! Даёт массу союзникам.',
        emoji: '👑',
        effect: 'taunt'
    },
    graviton: {
        id: 'graviton',
        name: 'Graviton',
        type: 'spell',
        family: 'boson',
        cost: 6,
        attack: null,
        health: null,
        description: 'Гравитационный коллапс: 8 урона врагу.',
        emoji: '🕳️',
        effect: 'damage',
        effectValue: 8
    },

    // АБСУРДНЫЕ КВАНТОВЫЕ КАРТЫ
    superposition: {
        id: 'superposition',
        name: 'Superposition',
        type: 'spell',
        family: 'absurd',
        cost: 3,
        attack: null,
        health: null,
        description: '50% шанс 20 урона, 50% шанс лечения врага на 10 HP. Квантовая неопределённость!',
        emoji: '🎲',
        effect: 'superposition',
        fact: 'Суперпозиция: частица находится во всех состояниях одновременно до измерения!'
    },
    schrodinger_cat: {
        id: 'schrodinger_cat',
        name: "Schrödinger's Cat",
        type: 'unit',
        family: 'absurd',
        cost: 4,
        attack: 5,
        health: 5,
        description: 'Кот в коробке. Жив или мёртв? При смерти: 50% воскрешение!',
        emoji: '🐱',
        effect: 'schrodinger',
        fact: 'Кот Шрёдингера — мысленный эксперимент о парадоксе наблюдения!'
    },
    observer: {
        id: 'observer',
        name: 'Observer',
        type: 'spell',
        family: 'absurd',
        cost: 2,
        attack: null,
        health: null,
        description: 'Следующий ход противника пропускается. Наблюдатель меняет реальность!',
        emoji: '👁️',
        effect: 'observer',
        fact: 'Эффект наблюдателя: измерение влияет на результат квантового эксперимента!'
    },
    entanglement: {
        id: 'entanglement',
        name: 'Entanglement',
        type: 'spell',
        family: 'absurd',
        cost: 5,
        attack: null,
        health: null,
        description: 'Связывает вас с врагом. Следующие 10 урона отражаются обратно!',
        emoji: '🔗',
        effect: 'entanglement',
        fact: 'Квантовая запутанность: "жуткое действие на расстоянии" (Эйнштейн)!'
    },
    tunneling: {
        id: 'tunneling',
        name: 'Tunneling',
        type: 'spell',
        family: 'absurd',
        cost: 3,
        attack: null,
        health: null,
        description: 'Наносит 8 урона, игнорируя защиту. Частица проходит сквозь стены!',
        emoji: '🏃',
        effect: 'tunneling',
        effectValue: 8,
        fact: 'Туннелирование: частица может пройти сквозь непроходимый барьер!'
    },
    wave_function: {
        id: 'wave_function',
        name: 'Wave Function',
        type: 'unit',
        family: 'absurd',
        cost: 6,
        attack: 7,
        health: 4,
        description: 'При вызове: случайный бафф союзнику (+3/+3 или +0/+6 или +6/+0).',
        emoji: '〰️',
        effect: 'wave_boost',
        fact: 'Волновая функция Ψ описывает все возможные состояния системы!'
    }
};

// ========================================
// CARD DETAILS (Scientific Information)
// ========================================

const CARD_DETAILS = {
    up_quark: {
        science: 'Up-кварк — один из шести ароматов кварков. Это легчайший кварк с массой около 2.2 МэВ/c². Вместе с down-кварком образует протоны (uud) и нейтроны (udd).',
        facts: [
            'Заряд: +⅔ элементарного заряда',
            'Спин: ½ (фермион)',
            'Открыт: 1964 году (теоретически предсказан М. Гелл-Манном и Дж. Цвейгом)'
        ]
    },
    down_quark: {
        science: 'Down-кварк — второй по массе кварк (около 4.7 МэВ/c²). Является компонентом протонов и нейтронов. Вместе с up-кварком составляет основу обычной материи.',
        facts: [
            'Заряд: -⅓ элементарного заряда',
            'Спин: ½ (фермион)',
            'Входит в состав атомных ядер всех элементов'
        ]
    },
    charm_quark: {
        science: 'Charm-кварк (очарованный) имеет массу около 1.27 ГэВ/c² — в 300 раз тяжелее up-кварка. Был открыт в 1974 году одновременно в SLAC (J/ψ мезон) и BNL.',
        facts: [
            'Заряд: +⅔ элементарного заряда',
            'Время жизни: около 10⁻¹² секунды',
            'Открыт в составе J/ψ мезона в ноябре 1974'
        ]
    },
    strange_quark: {
        science: 'Strange-кварк (странный) имеет массу около 95 МэВ/c². Назван так из-за "странных" свойств открытых в 1947 году гиперонов, содержащих эту частицу.',
        facts: [
            'Заряд: -⅓ элементарного заряда',
            'Спин: ½ (фермион)',
            'Создаёт "странность" в адронах'
        ]
    },
    top_quark: {
        science: 'Top-кварк (верхний) — самый тяжёлый кварк с массой около 173 ГэВ/c², что сопоставимо с массой атома золота! Живёт так мало, что не успевает адронизироваться.',
        facts: [
            'Заряд: +⅔ элементарного заряда',
            'Время жизни: ≈ 5×10⁻²⁵ секунды',
            'Открыт в 1995 году на Теватроне (Fermilab)'
        ]
    },
    bottom_quark: {
        science: 'Bottom-кварк (прелестный) имеет массу около 4.18 ГэВ/c². Входит в состав B-мезонов. Открыт в 1977 году в Fermilab в составе Υ-мезона.',
        facts: [
            'Заряд: -⅓ элементарного заряда',
            'Время жизни: около 1.6×10⁻¹² секунды',
            'Используется в исследованиях CP-нарушения'
        ]
    },
    electron: {
        science: 'Электрон — легчайшая стабильная частица с массой 0.511 МэВ/c². Вместе с ядром образует атомы. Впервые открыт Дж.Дж. Томсоном в 1897 году.',
        facts: [
            'Заряд: -1 элементарный заряд',
            'Спин: ½ (фермион)',
            'Определяет химические свойства элементов'
        ]
    },
    electron_neutrino: {
        science: 'Электронное нейтрино — нейтральная частица с ничтожно малой массой (менее 0.8 эВ/c²). За секунду через ваше тело проходят триллионы нейтрино от Солнца!',
        facts: [
            'Заряд: 0',
            'Очень слабо взаимодействует с материей',
            'Способно проходить сквозь световой год свинца'
        ]
    },
    muon: {
        science: 'Мюон — "тяжёлый электрон" с массой 105.7 МэВ/c² (в 207 раз тяжелее электрона). Открыт в 1936 году, живёт около 2.2 микросекунды.',
        facts: [
            'Заряд: -1 элементарный заряд',
            'Нестабилен, распадается на электрон и нейтрино',
            'Мюоны космических лучей достигают поверхности Земли'
        ]
    },
    muon_neutrino: {
        science: 'Мюонное нейтрино — нейтральный лептон, открытый в 1962 году. Несёт мюонное "лептонное число". Осцилляции нейтрино доказали, что они имеют массу.',
        facts: [
            'Заряд: 0',
            'Открыт в эксперименте Брукхейвенской НЛ',
            'Отличается от электронного нейтрино ароматом'
        ]
    },
    tau: {
        science: 'Тау-лептон — "тяжелейший лептон" с массой 1777 МэВ/c² (тяжелее протона!). Открыт в 1975 году, живёт всего 2.9×10⁻¹³ секунды.',
        facts: [
            'Заряд: -1 элементарный заряд',
            'Может распадаться на адроны',
            'Третье "поколение" материи'
        ]
    },
    tau_neutrino: {
        science: 'Тау-нейтрино — нейтральный лептон третьего поколения. Предсказан теоретически, но обнаружен экспериментально только в 2000 году в Fermilab.',
        facts: [
            'Заряд: 0',
            'Последняя открытая частица Стандартной модели',
            'Имеет наименьшую известную массу среди лептонов'
        ]
    },
    photon: {
        science: 'Фотон — квант электромагнитного поля, носитель света и всех электромагнитных взаимодействий. Имеет нулевую массу покоя и всегда движется со скоростью света.',
        facts: [
            'Масса покоя: 0',
            'Заряд: 0',
            'Спин: 1 (бозон)',
            'Скорость: 299 792 458 м/с в вакууме'
        ]
    },
    gluon: {
        science: 'Глюон — калибровочный бозон сильного взаимодействия, "склеивающий" кварки внутри протонов и нейтронов. Имеет 8 типов и обладает цветовым зарядом.',
        facts: [
            'Масса покоя: 0',
            'Переносит "цветовой" заряд',
            'Взаимодействует только с цветными частицами',
            'Не существует в свободном состоянии (конфайнмент)'
        ]
    },
    w_boson: {
        science: 'W-бозон — переносчик слабого взаимодействия. Имеет электрический заряд ±1. Масса около 80.4 ГэВ/c². Отвечает за бета-распад и радиоактивность.',
        facts: [
            'Масса: 80.4 ГэВ/c²',
            'Заряд: +1 или -1',
            'Открыт в 1983 году в CERN',
            'Спин: 1'
        ]
    },
    z_boson: {
        science: 'Z-боон — нейтральный переносчик слабого взаимодействия. Масса около 91.2 ГэВ/c². Взаимодействует со всеми фермионами (кроме нейтрино).',
        facts: [
            'Масса: 91.2 ГэВ/c²',
            'Заряд: 0',
            'Открыт в 1983 году в CERN',
            'Ответственен за нейтральные токи'
        ]
    },
    higgs_boson: {
        science: 'Бозон Хиггса — "божественная частица", предсказанная в 1964 году. Даёт массу другим частицам через механизм Хиггса. Открыт в 2012 году в CERN.',
        facts: [
            'Масса: 125 ГэВ/c²',
            'Спин: 0 (скалярный бозон)',
            'Нобелевская премия 2013: Хиггс и Энглер',
            'Подтверждает механизм нарушения электрослабой симметрии'
        ]
    },
    graviton: {
        science: 'Гравитон — гипотетический квант гравитационного поля. Ещё не обнаружен экспериментально. Предсказывается квантовой теорией гравитации.',
        facts: [
            'Масса покоя: 0 (предсказание)',
            'Спин: 2',
            'Слабейшее из всех взаимодействий',
            'Гравитационные волны — классическое проявление'
        ]
    },

    // АБСУРДНЫЕ КВАНТОВЫЕ КАРТЫ
    superposition: {
        science: 'Суперпозиция — способность квантовой системы находиться в нескольких состояниях одновременно до момента измерения. Знаменитый кот Шрёдингера — популярная метафора этого явления.',
        facts: [
            'Коллапс волновой функции при измерении',
            'Эксперимент: электрон проходит через две щели одновременно',
            'Квантовые компьютеры используют суперпозицию для параллельных вычислений'
        ]
    },
    schrodinger_cat: {
        science: 'Кот Шрёдингера — мысленный эксперимент Эрвина Шрёдингера (1935). Кот в коробке одновременно жив и мёртв до открытия. Парадокс демонстрирует проблему измерения в квантовой механике.',
        facts: [
            'Не реальный эксперимент — мысленный',
            'Демонстрирует проблему макроскопических квантовых состояний',
            'Кот: 50% жив, 50% мёртв до наблюдения'
        ]
    },
    observer: {
        science: 'Эффект наблюдателя — в квантовой механике само наблюдение влияет на результат. Частица "решает" своё состояние только когда её измеряют. Это не магия, а фундаментальное свойство реальности.',
        facts: [
            'Электрон не имеет определённой позиции до измерения',
            'Двухщелевой эксперимент меняется при наблюдении',
            'Наблюдатель = любое взаимодействие с системой'
        ]
    },
    entanglement: {
        science: 'Квантовая запутанность — феномен, когда две частицы связаны так, что состояние одной мгновенно влияет на другую, независимо от расстояния. Эйнштейн называл это "жутким дальнодействием".',
        facts: [
            'Связь сохраняется на любом расстоянии',
            'Нельзя передать информацию быстрее света',
            'Используется в квантовой криптографии'
        ]
    },
    tunneling: {
        science: 'Квантовое туннелирование — частица может "просочиться" сквозь энергетический барьер, даже если её энергия меньше высоты барьера. Это не магия, а волновая природа частиц.',
        facts: [
            'Радиоактивный альфа-распад использует туннелирование',
            'Сканирующие туннельные микроскопы видят атомы',
            'Туннельные диоды — основа электроники'
        ]
    },
    wave_function: {
        science: 'Волновая функция — математическое описание квантового состояния системы. Квадрат модуля волновой функции даёт вероятность обнаружить частицу в данной точке.',
        facts: [
            'Ψ (пси) — символ волновой функции',
            'Уравнение Шрёдингера описывает её эволюцию',
            'Коллапс Ψ при измерении — переход к определённости'
        ]
    }
};

// ========================================
// GAME STATE
// ========================================

class GameState {
    constructor() {
        this.turn = 1;
        this.maxMana = 1;
        this.currentMana = 1;
        this.opponentMaxMana = 1;
        this.opponentCurrentMana = 1;
        this.playerHP = 30;
        this.opponentHP = 30;
        this.playerDeck = [];
        this.opponentDeck = [];
        this.playerHand = [];
        this.opponentHand = [];
        this.playerField = [];
        this.opponentField = [];
        this.selectedCard = null;
        this.isPlayerTurn = true;
        this.gameOver = false;
        this.cardsPlayed = 0;
        this.totalTurns = 0;
        this.waitingForTarget = false;
        this.pendingSpell = null;
        this.entropy = 0;
        this.collapseCount = 0;
        this.entangled = false;
        this.entanglementTurns = 0;
        this.observerMode = false;
        this.observerTurns = 0;
    }
}

let game = new GameState();

// ========================================
// DOM ELEMENTS
// ========================================

const screens = {
    loading: document.getElementById('loading-screen'),
    menu: document.getElementById('menu-screen'),
    rules: document.getElementById('rules-screen'),
    cards: document.getElementById('cards-screen'),
    game: document.getElementById('game-screen'),
    end: document.getElementById('end-screen'),
    collapse: document.getElementById('collapse-screen')
};

const elements = {
    playerHP: document.getElementById('player-hp'),
    opponentHP: document.getElementById('opponent-hp'),
    playerManaText: document.getElementById('player-mana-text'),
    opponentManaText: document.getElementById('opponent-mana-text'),
    playerHand: document.getElementById('player-hand'),
    opponentHand: document.getElementById('opponent-hand'),
    playerPlayArea: document.getElementById('player-play-area'),
    aiPlayArea: document.getElementById('ai-play-area'),
    endTurnBtn: document.getElementById('end-turn-btn'),
    turnIndicator: document.getElementById('turn-indicator'),
    gameLog: document.querySelector('.log-content'),
    targetModal: document.getElementById('target-modal'),
    targetOptions: document.getElementById('target-options'),
    cancelTarget: document.getElementById('cancel-target'),
    gameContainer: document.getElementById('game-container'),
    entropyFill: document.getElementById('entropy-fill'),
    entropyPercent: document.getElementById('entropy-percent'),
    toastMessage: document.getElementById('toast-message'),
    collapseScreen: document.getElementById('collapse-screen'),
    collapseDescription: document.querySelector('.collapse-description'),
    collapseCount: document.getElementById('collapse-count')
};

// ========================================
// INITIALIZATION
// ========================================

function init() {
    // Setup event listeners
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('rules-btn').addEventListener('click', showRules);
    document.getElementById('cards-btn').addEventListener('click', showCards);
    document.getElementById('back-btn').addEventListener('click', hideRules);
    document.getElementById('cards-back-btn').addEventListener('click', hideCards);
    document.getElementById('restart-btn').addEventListener('click', restartGame);
    elements.endTurnBtn.addEventListener('click', endPlayerTurn);
    elements.cancelTarget.addEventListener('click', cancelSpellTarget);

    // Setup cards filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            filterCards(e.target.dataset.filter);
        });
    });

    // Show loading screen first
    setTimeout(() => {
        screens.loading.classList.add('hidden');
        screens.menu.classList.remove('hidden');
    }, 2000);
}

function showRules() {
    screens.menu.classList.add('hidden');
    screens.rules.classList.remove('hidden');
}

function hideRules() {
    screens.rules.classList.add('hidden');
    screens.menu.classList.remove('hidden');
}

function showCards() {
    screens.menu.classList.add('hidden');
    screens.cards.classList.remove('hidden');
    renderCardsEncyclopedia('all');
}

function hideCards() {
    screens.cards.classList.add('hidden');
    screens.menu.classList.remove('hidden');
}

function filterCards(filter) {
    renderCardsEncyclopedia(filter);
}

function renderCardsEncyclopedia(filter) {
    const grid = document.getElementById('cards-grid');
    grid.innerHTML = '';

    const cardKeys = Object.keys(CARD_DETAILS);

    cardKeys.forEach(key => {
        const details = CARD_DETAILS[key];
        const card = CARDS[key];

        if (filter === 'all' || card.family === filter) {
            const cardEl = createEncyclopediaCard(card, details);
            grid.appendChild(cardEl);
        }
    });
}

function createEncyclopediaCard(card, details) {
    const cardEl = document.createElement('div');
    cardEl.className = `encyclopedia-card ${card.family}`;

    let typeName = '';
    if (card.family === 'quark') typeName = 'Кварк';
    else if (card.family === 'lepton') typeName = 'Лептон';
    else if (card.family === 'boson') typeName = 'Бозон';
    else if (card.family === 'absurd') typeName = 'Абсурдная квантовая карта';

    const statsHtml = card.type === 'unit' ? `
        <div class="encyclopedia-game-info">
            <div class="game-stat">
                <span class="game-stat-label">Мана</span>
                <span class="game-stat-value cost">${card.cost}</span>
            </div>
            <div class="game-stat">
                <span class="game-stat-label">Атака</span>
                <span class="game-stat-value attack">${card.attack}</span>
            </div>
            <div class="game-stat">
                <span class="game-stat-label">HP</span>
                <span class="game-stat-value health">${card.health}</span>
            </div>
        </div>
    ` : `
        <div class="encyclopedia-game-info">
            <div class="game-stat">
                <span class="game-stat-label">Мана</span>
                <span class="game-stat-value cost">${card.cost}</span>
            </div>
            <div class="game-stat">
                <span class="game-stat-label">Тип</span>
                <span class="game-stat-value" style="color: var(--accent-gold);">Заклинание</span>
            </div>
        </div>
    `;

    cardEl.innerHTML = `
        <div class="encyclopedia-header">
            <div class="encyclopedia-icon">${card.emoji}</div>
            <div class="encyclopedia-info">
                <div class="encyclopedia-name">${card.name}</div>
                <div class="encyclopedia-family">${typeName}</div>
            </div>
        </div>
        <div class="encyclopedia-body">
            ${statsHtml}
            <div class="encyclopedia-description">
                <p class="encyclopedia-game-desc">"${card.description}"</p>
                <div class="encyclopedia-real-info">
                    <strong>📚 Научная справка:</strong><br>
                    ${details.science}
                </div>
                ${details.facts ? `
                <div class="encyclopedia-facts">
                    <strong>Интересные факты:</strong>
                    <ul>
                        ${details.facts.map(f => `<li>${f}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
            </div>
        </div>
    `;

    return cardEl;
}

function startGame() {
    // Reset game state
    game = new GameState();

    // Generate decks
    game.playerDeck = generateDeck();
    game.opponentDeck = generateDeck();

    // Draw initial hands (3 cards)
    for (let i = 0; i < 3; i++) {
        drawCard('player');
        drawCard('opponent');
    }

    // Setup UI
    updateUI();
    renderHands();
    renderFields();
    updateEntropyDisplay();

    // Show game screen
    screens.menu.classList.add('hidden');
    screens.game.classList.remove('hidden');

    log('Игра началась! Ваш ход.', 'system');

    // Check for any free cards at start
    checkPlayableCards();
}

// ========================================
// TOAST NOTIFICATIONS
// ========================================

function showToast(message, icon = '📚', type = 'fact') {
    const toast = elements.toastMessage;
    const toastContent = toast.querySelector('.toast-content');
    const toastText = toast.querySelector('.toast-text');
    const toastIcon = toast.querySelector('.toast-icon');

    toastContent.parentElement.className = `toast ${type}`;
    toastIcon.textContent = icon;
    toastText.textContent = message;

    toast.classList.remove('hidden');

    // Auto hide after 4 seconds
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// ========================================
// ENTROPY SYSTEM
// ========================================

function addEntropy(amount) {
    game.entropy = Math.min(100, game.entropy + amount);
    updateEntropyDisplay();

    if (game.entropy >= 100) {
        triggerQuantumCollapse();
    }
}

function updateEntropyDisplay() {
    elements.entropyFill.style.height = `${game.entropy}%`;
    elements.entropyPercent.textContent = `${Math.round(game.entropy)}%`;

    if (game.entropy >= 75) {
        elements.entropyFill.classList.add('critical');
    } else {
        elements.entropyFill.classList.remove('critical');
    }
}

// ========================================
// QUANTUM COLLAPSE EVENTS
// ========================================

const COLLAPSE_EVENTS = [
    {
        name: 'Инверсия гравитации',
        description: 'Гравитация инвертировалась! HP игрока и противника поменялись местами!',
        icon: '🔄',
        action: () => {
            const tempHP = game.playerHP;
            game.playerHP = game.opponentHP;
            game.opponentHP = tempHP;
            log('🔄 ГРАВИТАЦИЯ ИНВЕРТИРОВАЛАСЬ! HP ОБМЕНЯЛИСЬ!', 'damage');
            showToast('Гравитация инвертировалась! Это абсурд!', '🔄', 'absurd');
        }
    },
    {
        name: 'Временная петля',
        description: 'Время пошло вспять! Ход сбрасывается, но карты на руке меняются!',
        icon: '⏰',
        action: () => {
            // Return mana
            game.currentMana = game.maxMana;
            game.opponentCurrentMana = game.opponentMaxMana;
            game.isPlayerTurn = true;

            // Shuffle hands back and draw new cards
            const playerHand = [...game.playerHand];
            const opponentHand = [...game.opponentHand];
            game.playerHand = shuffle(playerHand).slice(0, Math.min(5, playerHand.length));
            game.opponentHand = shuffle(opponentHand).slice(0, Math.min(5, opponentHand.length));

            log('⏰ ВРЕМЕННАЯ ПЕТЛЯ! ХОД ВЕРНУЛСЯ!', 'damage');
            showToast('Время пошло вспять! Вы получаете новые карты!', '⏰', 'absurd');

            updateUI();
            renderHands();
        }
    },
    {
        name: 'Котомёт Шрёдингера',
        description: 'Кот выстрелил наугад! 15 урона случайной цели!',
        icon: '🐱',
        action: () => {
            const targets = ['player', 'opponent'];
            const target = targets[Math.floor(Math.random() * targets.length)];
            const damage = 15;

            dealDamageToHero(target, damage);
            log(`🐱 КОТОМЁТ! ${damage} урона ${target === 'player' ? 'ВАМ' : 'ПРОТИВНИКУ'}!`, 'damage');
            showToast('Кот Шрёдингера нанёс удар в квантовой суперпозиции!', '🐱', 'absurd');
        }
    },
    {
        name: 'Декогерентность',
        description: 'Все карты на поле теряют 2 HP! Квантовая когерентность разрушена!',
        icon: '💥',
        action: () => {
            game.playerField.forEach((card, index) => {
                dealDamageToCard(card, 2, index, 'player');
            });
            game.opponentField.forEach((card, index) => {
                dealDamageToCard(card, 2, index, 'opponent');
            });
            log('💥 ДЕКОГЕРЕНТНОСТЬ! ВСЕ ЮНИТЫ -2 HP!', 'damage');
            showToast('Квантовая когерентность разрушена!', '💥', 'absurd');
        }
    },
    {
        name: 'Квантовая флуктуация',
        description: 'Энергия хаотично флуктуирует! Все получают/теряют 5 HP!',
        icon: '〰️',
        action: () => {
            game.playerHP = Math.min(30, game.playerHP + 5);
            game.opponentHP = Math.min(30, game.opponentHP + 5);
            log('〰️ КВАНТОВАЯ ФЛУКТУАЦИЯ! ВСЕ +5 HP!', 'damage');
            showToast('Вакуумные флуктуации добавили энергии!', '〰️', 'absurd');
            updateUI();
        }
    }
];

function triggerQuantumCollapse() {
    game.collapseCount++;
    game.entropy = 0;

    const event = COLLAPSE_EVENTS[Math.floor(Math.random() * COLLAPSE_EVENTS.length)];

    // Show collapse screen
    screens.collapse.classList.remove('hidden');
    elements.collapseDescription.textContent = event.description;

    setTimeout(() => {
        screens.collapse.classList.add('hidden');
        event.action();
        updateUI();
        renderFields();
        checkGameOver();
    }, 2500);
}

function generateDeck() {
    const deck = [];
    const cardKeys = Object.keys(CARDS);

    // Add 2 copies of each card
    for (let i = 0; i < 2; i++) {
        cardKeys.forEach(key => {
            const card = { ...CARDS[key], uid: generateUID() };
            deck.push(card);
        });
    }

    // Shuffle
    return shuffle(deck);
}

function generateUID() {
    return Math.random().toString(36).substr(2, 9);
}

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ========================================
// CARD DRAWING
// ========================================

function drawCard(who) {
    const deck = who === 'player' ? game.playerDeck : game.opponentDeck;
    const hand = who === 'player' ? game.playerHand : game.opponentHand;

    if (deck.length > 0 && hand.length < 7) {
        const card = deck.pop();
        hand.push(card);

        if (who === 'player') {
            log(`Вы взяли: ${card.name}`, 'player');
        }
    }
}

// ========================================
// CARD RENDERING
// ========================================

function renderHands() {
    // Player hand
    elements.playerHand.innerHTML = '';
    game.playerHand.forEach((card, index) => {
        const cardEl = createCardElement(card, 'hand', index);
        elements.playerHand.appendChild(cardEl);
    });

    // Opponent hand (card backs)
    elements.opponentHand.innerHTML = '';
    game.opponentHand.forEach(() => {
        const backEl = document.createElement('div');
        backEl.className = 'card-back';
        elements.opponentHand.appendChild(backEl);
    });
}

function renderFields() {
    // Player field
    elements.playerPlayArea.innerHTML = '';
    game.playerField.forEach((card, index) => {
        const cardEl = createCardElement(card, 'field', index);
        elements.playerPlayArea.appendChild(cardEl);
    });

    // AI field
    elements.aiPlayArea.innerHTML = '';
    game.opponentField.forEach((card, index) => {
        const cardEl = createCardElement(card, 'field', index, true);
        elements.aiPlayArea.appendChild(cardEl);
    });
}

function createCardElement(card, location, index, isOpponent = false) {
    const cardEl = document.createElement('div');
    cardEl.className = `card ${card.family}`;
    cardEl.dataset.index = index;
    cardEl.dataset.id = card.id;

    if (location === 'hand') {
        cardEl.classList.add('in-hand');
        // Check if playable
        if (card.cost > game.currentMana || !game.isPlayerTurn) {
            cardEl.classList.add('disabled');
        }
    }

    if (location === 'field') {
        cardEl.classList.add('on-field');

        // Add attack status
        if (!card.hasAttacked && !isOpponent && card.canAttack !== false) {
            cardEl.classList.add('can-attack');
        }

        // Check for taunt
        if (card.effect === 'taunt') {
            cardEl.style.border = '3px solid #FFD700';
        }
    }

    // Create card HTML
    const cost = card.cost !== undefined ? card.cost : '?';
    const attack = card.attack !== null ? card.attack : '';
    const health = card.health !== null ? card.health : '';

    let typeIcon = '';
    if (card.family === 'quark') typeIcon = 'Q';
    else if (card.family === 'lepton') typeIcon = 'L';
    else if (card.family === 'boson') typeIcon = 'B';
    else if (card.family === 'absurd') typeIcon = 'A';

    cardEl.innerHTML = `
        <div class="card-cost">${cost}</div>
        <div class="card-type">${typeIcon}</div>
        <div class="card-image">${card.emoji}</div>
        <div class="card-name">${card.name}</div>
        <div class="card-description">${card.description}</div>
        ${card.attack !== null ? `<div class="card-stats">
            <div class="stat attack">${attack}</div>
            <div class="stat health">${health}</div>
        </div>` : ''}
    `;

    // Add event listeners for player cards
    if (!isOpponent) {
        if (location === 'hand') {
            cardEl.addEventListener('click', () => playCard(index));
        } else if (location === 'field') {
            cardEl.addEventListener('click', (e) => {
                const cardElement = e.currentTarget;
                const fieldIndex = Array.from(cardElement.parentElement.children).indexOf(cardElement);
                selectCardForAttack(fieldIndex);
            });
        }
    }

    return cardEl;
}

// ========================================
// CARD PLAYING
// ========================================

function playCard(index) {
    if (!game.isPlayerTurn || game.gameOver) return;

    const card = game.playerHand[index];

    if (card.cost > game.currentMana) {
        shakeElement(elements.playerHand);
        log('Недостаточно энергии!', 'damage');
        return;
    }

    // Handle absurd card special effects
    if (card.family === 'absurd' && card.effect) {
        playAbsurdCard(card, index);
        return;
    }

    // Handle spells
    if (card.type === 'spell') {
        playSpell(card, index);
        return;
    }

    // Check field space
    if (game.playerField.length >= 7) {
        log('Поле заполнено!', 'damage');
        return;
    }

    // Play the card
    game.currentMana -= card.cost;
    game.playerHand.splice(index, 1);
    game.playerField.push(card);
    game.cardsPlayed++;

    // Add summon effect
    card.hasAttacked = true; // Can't attack on turn played
    card.canAttack = false;

    // Add entropy for each card played
    addEntropy(15);

    // Show fact toast
    if (card.fact) {
        showToast(card.fact, card.emoji, 'fact');
    }

    log(`Призван: ${card.name}`, 'player');

    // Update UI
    updateUI();
    renderHands();
    renderFields();
    checkPlayableCards();

    // Check win condition
    checkGameOver();
}

function playAbsurdCard(card, handIndex) {
    game.currentMana -= card.cost;
    game.playerHand.splice(handIndex, 1);
    game.cardsPlayed++;

    // Add entropy for absurd cards
    addEntropy(20);

    switch (card.effect) {
        case 'superposition':
            // 50/50 chance: 20 damage or heal enemy 10
            const success = Math.random() > 0.5;
            if (success) {
                game.waitingForTarget = true;
                game.pendingSpell = { card, handIndex, superpositionDamage: 20 };
                showTargetSelection(true);
                log(`СУПЕРПОЗИЦИЯ: ${card.name} выбирает состояние атаки!`, 'player');
            } else {
                // Heal enemy instead
                game.opponentHP = Math.min(30, game.opponentHP + 10);
                log(`СУПЕРПОЗИЦИЯ: ${card.name} залечил противника на 10 HP!`, 'player');
                showToast('Суперпозиция схлопнулась в состояние лечения!', '🎲', 'absurd');
            }
            break;

        case 'schrodinger':
            // Unit with resurrection chance
            game.playerField.push(card);
            card.hasAttacked = true;
            card.canAttack = false;
            card.schrodingerAlive = true;
            log(`Призван: ${card.name} (Шрёдингер)`, 'player');
            showToast(card.fact, '🐱', 'fact');
            break;

        case 'observer':
            // Skip opponent's next turn
            game.observerMode = true;
            game.observerTurns = 1;
            log(`ЭФФЕКТ НАБЛЮДАТЕЛЯ: ${card.name} остановил время!`, 'player');
            showToast(card.fact, '👁️', 'fact');
            break;

        case 'entanglement':
            // Reflect damage back
            game.entangled = true;
            game.entanglementTurns = 2;
            log(`ЗАПУТАННОСТЬ: ${card.name} связал вас с противником!`, 'player');
            showToast(card.fact, '🔗', 'fact');
            break;

        case 'tunneling':
            // Ignore defense - direct damage to hero
            dealDamageToHero('opponent', card.effectValue);
            log(`ТУННЕЛИРОВАНИЕ: ${card.name} прошёл сквозь защиту! ${card.effectValue} урона!`, 'player');
            showToast(card.fact, '🏃', 'fact');
            break;

        case 'wave_boost':
            // Random buff to a random ally
            game.playerField.push(card);
            card.hasAttacked = true;
            card.canAttack = false;

            if (game.playerField.length > 1) {
                const allyIndex = Math.floor(Math.random() * (game.playerField.length - 1));
                const ally = game.playerField[allyIndex];
                const buffType = Math.random();
                if (buffType < 0.33) {
                    ally.attack += 3;
                    ally.health += 3;
                    log(`ВОЛНОВАЯ ФУНКЦИЯ: ${ally.name} получил +3/+3!`, 'player');
                } else if (buffType < 0.66) {
                    ally.attack += 6;
                    log(`ВОЛНОВАЯ ФУНКЦИЯ: ${ally.name} получил +6 атаки!`, 'player');
                } else {
                    ally.health += 6;
                    log(`ВОЛНОВАЯ ФУНКЦИЯ: ${ally.name} получил +6 HP!`, 'player');
                }
            }
            log(`Призван: ${card.name}`, 'player');
            showToast(card.fact, '〰️', 'fact');
            break;
    }

    updateUI();
    renderHands();
    renderFields();
    checkPlayableCards();
    checkGameOver();
}

function playSpell(card, handIndex) {
    if (card.effect === 'damage') {
        // Need to select target
        game.waitingForTarget = true;
        game.pendingSpell = { card, handIndex };
        showTargetSelection(true);
        log(`Выберите цель для ${card.name}`, 'system');
    } else if (card.effect === 'buff_all') {
        // Buff all player units
        game.playerField.forEach(unit => {
            unit.attack += card.effectValue;
            unit.health += card.effectValue;
        });

        game.currentMana -= card.cost;
        game.playerHand.splice(handIndex, 1);
        game.cardsPlayed++;

        log(`${card.name}: Все ваши существа получили +${card.effectValue}/+${card.effectValue}!`, 'player');

        updateUI();
        renderHands();
        renderFields();
        checkPlayableCards();
    }
}

function showTargetSelection(forSpell) {
    elements.targetModal.classList.remove('hidden');
    elements.targetOptions.innerHTML = '';

    // Show opponent units
    game.opponentField.forEach((card, index) => {
        const option = document.createElement('div');
        option.className = 'card quark targetable';
        option.innerHTML = `
            <div class="card-image">${card.emoji}</div>
            <div class="card-name">${card.name}</div>
            <div class="card-stats">
                <div class="stat attack">${card.attack}</div>
                <div class="stat health">${card.health}</div>
            </div>
        `;
        option.addEventListener('click', () => {
            castSpellOnTarget('unit', index);
        });
        elements.targetOptions.appendChild(option);
    });

    // Show opponent hero
    const heroOption = document.createElement('div');
    heroOption.className = 'hero-portrait opponent targetable';
    heroOption.style.width = '80px';
    heroOption.style.height = '80px';
    heroOption.innerHTML = `
        <div class="portrait-image">
            <svg viewBox="0 0 100 100" class="portrait-svg">
                <circle cx="50" cy="50" r="45" fill="#1a1a2e" stroke="#e94560" stroke-width="2"/>
                <text x="50" y="55" text-anchor="middle" fill="#e94560" font-size="30">🤖</text>
            </svg>
        </div>
        <div class="health-text">HP: ${game.opponentHP}</div>
    `;
    heroOption.addEventListener('click', () => {
        castSpellOnTarget('hero', null);
    });
    elements.targetOptions.appendChild(heroOption);
}

function cancelSpellTarget() {
    game.waitingForTarget = false;
    game.pendingSpell = null;
    elements.targetModal.classList.add('hidden');
}

function castSpellOnTarget(targetType, targetIndex) {
    if (!game.pendingSpell) return;

    const { card, handIndex } = game.pendingSpell;

    if (targetType === 'unit') {
        const target = game.opponentField[targetIndex];
        dealDamageToCard(target, card.effectValue, targetIndex, 'opponent');

        log(`${card.name} наносит ${card.effectValue} урона ${target.name}!`, 'damage');
    } else {
        dealDamageToHero('opponent', card.effectValue);
        log(`${card.name} наносит ${card.effectValue} урона противнику!`, 'damage');
    }

    // Consume the spell
    game.currentMana -= card.cost;
    game.playerHand.splice(handIndex, 1);
    game.cardsPlayed++;

    // Clear selection
    game.waitingForTarget = false;
    game.pendingSpell = null;
    elements.targetModal.classList.add('hidden');

    updateUI();
    renderHands();
    renderFields();
    checkPlayableCards();

    checkGameOver();
}

// ========================================
// COMBAT
// ========================================

function selectCardForAttack(index) {
    if (!game.isPlayerTurn || game.gameOver) return;

    const card = game.playerField[index];

    if (card.hasAttacked) {
        shakeElement(elements.playerPlayArea);
        log(`${card.name} уже атаковал в этом ходу!`, 'damage');
        return;
    }

    // Deselect previous
    document.querySelectorAll('.card.selected').forEach(el => el.classList.remove('selected'));

    // Select this card
    game.selectedCard = index;
    const cardEl = elements.playerPlayArea.children[index];
    cardEl.classList.add('selected');

    // Show targets
    highlightTargets();
}

function highlightTargets() {
    // Highlight opponent units with taunt
    const tauntUnits = game.opponentField.filter(card => card.effect === 'taunt');

    const opponentCards = elements.aiPlayArea.querySelectorAll('.card');
    opponentCards.forEach((el, index) => {
        const card = game.opponentField[index];
        if (tauntUnits.length > 0) {
            if (card.effect === 'taunt') {
                el.classList.add('targetable');
            } else {
                el.classList.remove('targetable');
            }
        } else {
            el.classList.add('targetable');
        }
    });

    // Highlight opponent hero
    const heroEl = document.querySelector('#opponent-hero .hero-portrait');
    if (heroEl) {
        heroEl.classList.add('targetable');
        heroEl.onclick = () => attackHero(index);
    }

    // Add click handlers to opponent cards
    opponentCards.forEach((el, index) => {
        el.onclick = () => {
            if (el.classList.contains('targetable')) {
                attackCard(index);
            }
        };
    });
}

function attackCard(targetIndex) {
    if (game.selectedCard === null) return;

    const attacker = game.playerField[game.selectedCard];
    const defender = game.opponentField[targetIndex];

    // Combat
    log(`${attacker.name} атакует ${defender.name}!`, 'player');

    // Attacker animation
    const attackerEl = elements.playerPlayArea.children[game.selectedCard];
    attackerEl.classList.add('attacking');
    setTimeout(() => attackerEl.classList.remove('attacking'), 300);

    // Deal damage
    dealDamageToCard(attacker, defender.attack, game.selectedCard, 'player');
    dealDamageToCard(defender, attacker.attack, targetIndex, 'opponent');

    // Mark attacker as used
    attacker.hasAttacked = true;
    attacker.canAttack = false;

    // Clear selection
    game.selectedCard = null;
    document.querySelectorAll('.card.selected').forEach(el => el.classList.remove('selected'));
    clearTargets();

    updateUI();
    renderFields();

    checkGameOver();
}

function attackHero(targetIndex) {
    if (game.selectedCard === null) return;

    const attacker = game.playerField[game.selectedCard];

    log(`${attacker.name} атакует Лабораторию противника!`, 'player');

    // Attacker animation
    const attackerEl = elements.playerPlayArea.children[game.selectedCard];
    attackerEl.classList.add('attacking');
    setTimeout(() => attackerEl.classList.remove('attacking'), 300);

    // Deal damage to hero
    dealDamageToHero('opponent', attacker.attack);

    // Mark attacker as used
    attacker.hasAttacked = true;
    attacker.canAttack = false;

    // Clear selection
    game.selectedCard = null;
    document.querySelectorAll('.card.selected').forEach(el => el.classList.remove('selected'));
    clearTargets();

    updateUI();
    renderFields();

    checkGameOver();
}

function clearTargets() {
    document.querySelectorAll('.targetable').forEach(el => {
        el.classList.remove('targetable');
        el.onclick = null;
    });
}

function dealDamageToCard(card, damage, index, owner) {
    card.health -= damage;

    // Show damage number
    showDamageNumber(damage, owner === 'player' ?
        elements.playerPlayArea.children[index] :
        elements.aiPlayArea.children[index]
    );

    if (card.health <= 0) {
        // Remove dead card
        if (owner === 'player') {
            const el = elements.playerPlayArea.children[index];
            el.classList.add('dying');
            setTimeout(() => {
                game.playerField.splice(index, 1);
                renderFields();
            }, 500);
        } else {
            const el = elements.aiPlayArea.children[index];
            el.classList.add('dying');
            setTimeout(() => {
                game.opponentField.splice(index, 1);
                renderFields();
            }, 500);
        }
    }
}

function dealDamageToHero(owner, damage) {
    if (owner === 'player') {
        game.playerHP -= damage;
        elements.playerHP.textContent = Math.max(0, game.playerHP);

        const heroEl = document.querySelector('#player-hero .hero-portrait');
        heroEl.classList.add('hit');
        setTimeout(() => heroEl.classList.remove('hit'), 500);

        showDamageNumber(damage, document.querySelector('#player-hero'));
    } else {
        game.opponentHP -= damage;
        elements.opponentHP.textContent = Math.max(0, game.opponentHP);

        const heroEl = document.querySelector('#opponent-hero .hero-portrait');
        heroEl.classList.add('hit');
        setTimeout(() => heroEl.classList.remove('hit'), 500);

        showDamageNumber(damage, document.querySelector('#opponent-hero'));
    }

    // Shake screen on hero damage
    if (damage >= 5) {
        elements.gameContainer.classList.add('shake');
        setTimeout(() => elements.gameContainer.classList.remove('shake'), 500);
    }
}

function showDamageNumber(damage, element) {
    const dmgEl = document.createElement('div');
    dmgEl.className = 'damage-number';
    dmgEl.textContent = `-${damage}`;

    const rect = element.getBoundingClientRect();
    dmgEl.style.left = `${rect.left + rect.width / 2}px`;
    dmgEl.style.top = `${rect.top}px`;

    document.body.appendChild(dmgEl);

    setTimeout(() => dmgEl.remove(), 1000);
}

// ========================================
// TURN MANAGEMENT
// ========================================

function checkPlayableCards() {
    const cards = elements.playerHand.querySelectorAll('.card');
    cards.forEach((el, index) => {
        const card = game.playerHand[index];
        if (card.cost <= game.currentMana && game.isPlayerTurn) {
            el.classList.remove('disabled');
        } else {
            el.classList.add('disabled');
        }
    });
}

function endPlayerTurn() {
    if (!game.isPlayerTurn || game.gameOver) return;

    game.isPlayerTurn = false;
    elements.endTurnBtn.disabled = true;
    elements.turnIndicator.textContent = 'ХОД ПРОТИВНИКА';
    elements.turnIndicator.style.borderColor = 'var(--accent-red)';
    elements.turnIndicator.style.color = 'var(--accent-red)';

    log('Ход противника...', 'system');

    // Clear any selections
    game.selectedCard = null;
    clearTargets();

    // AI Turn
    setTimeout(aiTurn, 1000);
}

async function aiTurn() {
    game.totalTurns++;

    // AI draws a card
    drawCard('opponent');

    // AI gains mana
    if (game.opponentMaxMana < 10) {
        game.opponentMaxMana++;
    }
    game.opponentCurrentMana = game.opponentMaxMana;

    // Update AI mana display
    elements.opponentManaText.textContent = `${game.opponentCurrentMana}/${game.opponentMaxMana}`;

    renderHands();

    // AI plays cards
    await aiPlayCards();

    // AI attacks
    await aiAttack();

    // End AI turn
    endAiTurn();
}

async function aiPlayCards() {
    const hand = game.opponentHand;

    // Sort by cost (play expensive cards first)
    const sortedHand = [...hand].sort((a, b) => b.cost - a.cost);

    for (const card of sortedHand) {
        if (game.opponentField.length >= 7) break;
        if (card.cost > game.opponentCurrentMana) continue;

        // Play the card
        await delay(500);

        game.opponentCurrentMana -= card.cost;
        const cardIndex = game.opponentHand.findIndex(c => c.uid === card.uid);
        if (cardIndex > -1) {
            game.opponentHand.splice(cardIndex, 1);

            // Handle spells
            if (card.type === 'spell') {
                if (card.effect === 'damage') {
                    // Target random enemy unit or player
                    if (game.playerField.length > 0 && Math.random() > 0.3) {
                        const targetIndex = Math.floor(Math.random() * game.playerField.length);
                        dealDamageToCard(game.playerField[targetIndex], card.effectValue, targetIndex, 'player');
                        log(`Противник: ${card.name} наносит урон ${game.playerField[targetIndex].name}`, 'enemy');
                    } else {
                        dealDamageToHero('player', card.effectValue);
                        log(`Противник: ${card.name} наносит ${card.effectValue} урона вам!`, 'enemy');
                    }
                } else if (card.effect === 'buff_all') {
                    game.opponentField.forEach(unit => {
                        unit.attack += card.effectValue;
                        unit.health += card.effectValue;
                    });
                    log(`Противник: ${card.name} усиливает свои войска!`, 'enemy');
                }
            } else {
                card.hasAttacked = true;
                game.opponentField.push(card);
                log(`Противник призывает: ${card.name}`, 'enemy');
            }

            updateUI();
            renderHands();
            renderFields();

            checkGameOver();
            if (game.gameOver) return;
        }
    }
}

async function aiAttack() {
    for (const card of game.opponentField) {
        if (card.hasAttacked) continue;

        await delay(300);

        // AI logic: prioritize killing player units, then face
        let target = null;
        let targetIndex = -1;

        // Check for taunt
        const tauntUnits = game.playerField.filter(c => c.effect === 'taunt');
        if (tauntUnits.length > 0) {
            target = tauntUnits[0];
            targetIndex = game.playerField.indexOf(target);
        } else {
            // Try to kill a unit
            for (let i = 0; i < game.playerField.length; i++) {
                const playerUnit = game.playerField[i];
                if (card.attack >= playerUnit.health && card.health > playerUnit.attack) {
                    target = playerUnit;
                    targetIndex = i;
                    break;
                }
            }

            // If no good trade, attack face
            if (!target && game.playerHP <= card.attack) {
                dealDamageToHero('player', card.attack);
                log(`Противник: ${card.name} атакует вас!`, 'enemy');
                card.hasAttacked = true;

                updateUI();
                checkGameOver();
                if (game.gameOver) return;
                continue;
            }
        }

        if (target) {
            dealDamageToCard(card, target.attack, game.opponentField.indexOf(card), 'opponent');
            dealDamageToCard(target, card.attack, targetIndex, 'player');
            log(`Противник: ${card.name} атакует ${target.name}`, 'enemy');
        } else if (!tauntUnits.length) {
            // No taunt, attack random unit or face
            if (game.playerField.length > 0) {
                const randomTarget = game.playerField[Math.floor(Math.random() * game.playerField.length)];
                const randomIndex = game.playerField.indexOf(randomTarget);
                dealDamageToCard(card, randomTarget.attack, game.opponentField.indexOf(card), 'opponent');
                dealDamageToCard(randomTarget, card.attack, randomIndex, 'player');
                log(`Противник: ${card.name} атакует ${randomTarget.name}`, 'enemy');
            } else {
                dealDamageToHero('player', card.attack);
                log(`Противник: ${card.name} атакует вас!`, 'enemy');
            }
        }

        card.hasAttacked = true;

        updateUI();
        renderFields();

        checkGameOver();
        if (game.gameOver) return;
    }
}

function endAiTurn() {
    // Reset AI units
    game.opponentField.forEach(card => {
        card.hasAttacked = false;
    });

    // Player turn starts
    game.turn++;
    game.isPlayerTurn = true;

    // Player gains mana
    if (game.maxMana < 10) {
        game.maxMana++;
    }
    game.currentMana = game.maxMana;

    // Player draws a card
    drawCard('player');

    // Reset player units
    game.playerField.forEach(card => {
        card.hasAttacked = false;
        card.canAttack = true;
    });

    // Update UI
    updateUI();
    renderHands();
    renderFields();
    checkPlayableCards();

    elements.endTurnBtn.disabled = false;
    elements.turnIndicator.textContent = 'ВАШ ХОД';
    elements.turnIndicator.style.borderColor = 'var(--accent-cyan)';
    elements.turnIndicator.style.color = 'var(--accent-cyan)';

    log(`Ход ${game.turn}. Ваша энергия: ${game.currentMana}`, 'system');
}

// ========================================
// UI UPDATES
// ========================================

function updateUI() {
    elements.playerHP.textContent = Math.max(0, game.playerHP);
    elements.opponentHP.textContent = Math.max(0, game.opponentHP);
    elements.playerManaText.textContent = `${game.currentMana}/${game.maxMana}`;
    elements.opponentManaText.textContent = `${game.opponentCurrentMana}/${game.opponentMaxMana}`;

    // Update health bars
    const playerHealthFill = document.querySelector('.health-fill.player');
    const opponentHealthFill = document.querySelector('.health-fill.opponent');
    playerHealthFill.style.width = `${(game.playerHP / 30) * 100}%`;
    opponentHealthFill.style.width = `${(game.opponentHP / 30) * 100}%`;
}

function log(message, type = 'system') {
    const entry = document.createElement('p');
    entry.className = `log-entry ${type}`;
    entry.textContent = message;
    elements.gameLog.insertBefore(entry, elements.gameLog.firstChild);

    // Keep only last 20 entries
    while (elements.gameLog.children.length > 20) {
        elements.gameLog.removeChild(elements.gameLog.lastChild);
    }
}

// ========================================
// GAME OVER
// ========================================

function checkGameOver() {
    if (game.playerHP <= 0) {
        game.gameOver = true;
        showEndScreen(false);
    } else if (game.opponentHP <= 0) {
        game.gameOver = true;
        showEndScreen(true);
    }
}

function showEndScreen(playerWon) {
    setTimeout(() => {
        screens.game.classList.add('hidden');
        screens.end.classList.remove('hidden');

        const endResult = document.getElementById('end-result');
        endResult.className = `end-result ${playerWon ? 'victory' : 'defeat'}`;

        document.getElementById('end-title').textContent = playerWon ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ';
        document.getElementById('end-message').textContent = playerWon ?
            'Вы успешно завершили квантовый эксперимент!' :
            'Ваша лаборатория уничтожена...';

        document.getElementById('total-turns').textContent = game.totalTurns;
        document.getElementById('cards-played').textContent = game.cardsPlayed;
        if (elements.collapseCount) {
            elements.collapseCount.textContent = game.collapseCount;
        }
    }, 1000);
}

function restartGame() {
    screens.end.classList.add('hidden');
    startGame();
}

// ========================================
// UTILITIES
// ========================================

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function shakeElement(element) {
    element.classList.add('shake');
    setTimeout(() => element.classList.remove('shake'), 500);
}

// ========================================
// START THE GAME
// ========================================

init();
