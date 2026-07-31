import {GAME_META} from './game.js'

const clamp = (value, minimum = 0, maximum = 100) => (
  Math.min(maximum, Math.max(minimum, value))
)

const average = (values) => (
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
)

const percent = (value) => Math.round(value * 100)

const metricScore = (decisions, predicate, property = 'isOptimal') => {
  const relevant = decisions.filter(predicate)
  if (!relevant.length) return {score: 0, sample: 0}
  return {
    score: percent(relevant.filter((decision) => decision[property]).length / relevant.length),
    sample: relevant.length,
  }
}

function buildProfile({optimalRate, averageReactionTime, hardRate}) {
  if (optimalRate >= 0.82) {
    return {
      name: 'Instinct cohérent',
      strapline: 'Tu sens la meilleure option sans confondre probabilité et certitude.',
      summary: 'Sur cette session, tes choix suivent souvent le signal le plus favorable, même lorsque le résultat final reste incertain.',
    }
  }
  if (averageReactionTime < 2300 && optimalRate < 0.62) {
    return {
      name: 'Éclaireur impulsif',
      strapline: 'La décision part vite, parfois avant que le signal ne se stabilise.',
      summary: 'Ton rythme est offensif. Les situations proches de 50/50 sont celles où une micro-pause pourrait le mieux protéger tes décisions.',
    }
  }
  if (averageReactionTime > 4300 && optimalRate >= 0.68) {
    return {
      name: 'Stratège méthodique',
      strapline: 'Tu privilégies la cohérence, même lorsque le temps pousse.',
      summary: 'Tes choix sont souvent rationnels, mais les épreuves simples consomment encore une part importante du temps disponible.',
    }
  }
  if (hardRate > optimalRate * 100 + 8) {
    return {
      name: 'Intuitif sous tension',
      strapline: 'L’incertitude semble concentrer ton attention.',
      summary: 'Tu t’en sors mieux lorsque les probabilités sont proches que sur les décisions évidentes : la difficulté paraît activer ta vigilance.',
    }
  }
  return {
    name: 'Profil adaptatif',
    strapline: 'Ton seuil entre instinct et vérification est encore en mouvement.',
    summary: 'La session révèle une stratégie mixte : tu ajustes ton rythme selon le format, avec une marge de progression surtout sur les cas ambigus.',
  }
}

function detectInsights(decisions, categoryMetrics) {
  const insights = []
  const hard = decisions.filter((decision) => decision.uncertainty >= 0.65)
  const easy = decisions.filter((decision) => decision.uncertainty < 0.35)
  const hardRate = hard.length ? percent(hard.filter((item) => item.isOptimal).length / hard.length) : 0
  const easyRate = easy.length ? percent(easy.filter((item) => item.isOptimal).length / easy.length) : 0

  insights.push(
    hard.length >= 3 && hardRate < easyRate - 14
      ? {
          tone: 'attention',
          eyebrow: 'Sous incertitude',
          title: 'Le brouillard accélère les erreurs',
          copy: `${hardRate} % de choix optimaux dans les cas ambigus, contre ${easyRate} % dans les situations plus lisibles. Une seconde de vérification protège ici davantage que sur les cas simples.`,
        }
      : {
          tone: 'positive',
          eyebrow: 'Sous incertitude',
          title: 'Le signal reste lisible',
          copy: hard.length
            ? `${hardRate} % de décisions rationnelles quand les options étaient proches. Tu ne sembles pas fuir automatiquement l’ambiguïté.`
            : 'La session contient encore trop peu de cas ambigus pour conclure.',
        },
  )

  const cards = decisions.filter((decision) => decision.gameType === 'cards' && !decision.timedOut)
  const positions = new Map()
  cards.forEach((decision) => positions.set(decision.selectedOption, (positions.get(decision.selectedOption) || 0) + 1))
  const dominantShare = cards.length ? Math.max(0, ...positions.values()) / cards.length : 0
  insights.push(
    dominantShare >= 0.65 && cards.length >= 4
      ? {
          tone: 'neutral',
          eyebrow: 'Biais de position',
          title: 'Une position favorite apparaît',
          copy: `${Math.round(dominantShare * 100)} % de tes choix de cartes se concentrent au même endroit, alors que leur emplacement ne change pas la probabilité.`,
        }
      : {
          tone: 'positive',
          eyebrow: 'Biais de position',
          title: 'Pas de rituel visible',
          copy: 'Tes choix de cartes ne montrent pas de préférence de position assez forte pour être signalée.',
        },
  )

  const secondHalf = decisions.slice(Math.floor(decisions.length / 2))
  const firstHalf = decisions.slice(0, Math.floor(decisions.length / 2))
  const firstRate = firstHalf.length ? percent(firstHalf.filter((item) => item.isOptimal).length / firstHalf.length) : 0
  const secondRate = secondHalf.length ? percent(secondHalf.filter((item) => item.isOptimal).length / secondHalf.length) : 0
  insights.push({
    tone: secondRate >= firstRate ? 'positive' : 'neutral',
    eyebrow: 'Adaptation',
    title: secondRate >= firstRate + 8 ? 'La lecture s’affine' : secondRate < firstRate - 8 ? 'La difficulté rattrape le rythme' : 'Stratégie stable',
    copy: `Choix optimaux : ${firstRate} % en première moitié, ${secondRate} % en seconde. ${secondRate >= firstRate ? 'Tu absorbes la progression sans perte nette.' : 'La montée en difficulté pèse sur la fin de session.'}`,
  })

  const riskDecisions = decisions.filter((decision) => decision.gameType === 'risk' && !decision.timedOut)
  if (riskDecisions.length) {
    const continued = riskDecisions.filter((decision) => decision.selectedOption === 'continue').length
    const rational = riskDecisions.filter((decision) => decision.isOptimal).length
    insights.push({
      tone: rational / riskDecisions.length >= 0.67 ? 'positive' : 'neutral',
      eyebrow: 'Seuil de risque',
      title: continued >= Math.ceil(riskDecisions.length * 0.67)
        ? 'Tu pousses la tour'
        : continued === 0
          ? 'Tu protèges rapidement le gain'
          : 'Tu alternes audace et protection',
      copy: `${continued} continuation${continued > 1 ? 's' : ''} sur ${riskDecisions.length}, avec ${rational} décision${rational > 1 ? 's' : ''} favorable${rational > 1 ? 's' : ''} en valeur probable. Ce signal décrit ton seuil dans cette partie.`,
    })
  }

  const strongest = [...categoryMetrics].sort((a, b) => b.score - a.score)[0]
  if (strongest) {
    insights.push({
      tone: 'positive',
      eyebrow: 'Point fort',
      title: strongest.label,
      copy: `${strongest.score} / 100 sur ${strongest.sample} décision${strongest.sample > 1 ? 's' : ''} observée${strongest.sample > 1 ? 's' : ''}. C’est le signal le plus solide de cette session.`,
    })
  }
  return {insights, hardRate}
}

export function analyzeSession(decisions, history = []) {
  const answered = decisions.filter((decision) => !decision.timedOut)
  const correct = decisions.filter((decision) => decision.isCorrect).length
  const optimal = decisions.filter((decision) => decision.isOptimal).length
  const accuracy = decisions.length ? correct / decisions.length : 0
  const optimalRate = decisions.length ? optimal / decisions.length : 0
  const averageReactionTime = Math.round(average(answered.map((decision) => decision.reactionTimeMs)))
  const speedScore = Math.round(clamp(105 - (averageReactionTime - 1200) / 42))

  const intuition = metricScore(decisions, (decision) => ['cards', 'dice', 'bag', 'fireflies', 'hands', 'path'].includes(decision.gameType))
  const estimation = metricScore(decisions, (decision) => ['dots', 'fireflies'].includes(decision.gameType))
  const uncertainty = metricScore(decisions, (decision) => decision.uncertainty >= 0.55)
  const ratios = metricScore(decisions, (decision) => decision.gameType === 'boxes')
  const implicitLearning = metricScore(decisions, (decision) => ['hands', 'doors'].includes(decision.gameType))
  const risk = metricScore(decisions, (decision) => decision.gameType === 'risk')
  const firstHalf = decisions.slice(0, Math.floor(decisions.length / 2))
  const secondHalf = decisions.slice(Math.floor(decisions.length / 2))
  const firstRate = firstHalf.length ? percent(firstHalf.filter((item) => item.isOptimal).length / firstHalf.length) : 0
  const secondRate = secondHalf.length ? percent(secondHalf.filter((item) => item.isOptimal).length / secondHalf.length) : 0
  const adaptation = {
    score: Math.round(clamp(
      implicitLearning.sample
        ? implicitLearning.score * 0.7 + clamp(55 + (secondRate - firstRate) * 1.5) * 0.3
        : 55 + (secondRate - firstRate) * 1.5,
    )),
    sample: implicitLearning.sample || decisions.length,
  }
  const categoryMetrics = [
    {id: 'intuition', label: 'Intuition probabiliste', ...intuition},
    {id: 'estimation', label: 'Estimation numérique', ...estimation},
    {id: 'uncertainty', label: 'Décision sous incertitude', ...uncertainty},
    {id: 'ratios', label: 'Comparaison de proportions', ...ratios},
    {id: 'adaptation', label: 'Adaptation', ...adaptation},
    {id: 'risk', label: 'Gestion du risque', ...risk},
    {id: 'speed', label: 'Vitesse de décision', score: speedScore, sample: answered.length},
  ]

  const {insights, hardRate} = detectInsights(decisions, categoryMetrics)
  const profile = buildProfile({
    optimalRate,
    averageReactionTime,
    hardRate,
  })
  const previousScores = history.map((session) => Number(session.score) || 0)
  const previousAverage = previousScores.length ? Math.round(average(previousScores)) : null

  const gameBreakdown = Object.entries(GAME_META).map(([id, meta]) => {
    const relevant = decisions.filter((decision) => decision.gameType === id)
    return {
      id,
      label: meta.label,
      sample: relevant.length,
      accuracy: relevant.length ? percent(relevant.filter((item) => item.isCorrect).length / relevant.length) : 0,
      optimalRate: relevant.length ? percent(relevant.filter((item) => item.isOptimal).length / relevant.length) : 0,
      reactionTime: Math.round(average(relevant.filter((item) => !item.timedOut).map((item) => item.reactionTimeMs))),
    }
  })

  return {
    profile,
    accuracy,
    optimalRate,
    averageReactionTime,
    categoryMetrics,
    insights,
    gameBreakdown,
    previousAverage,
    historySize: history.length,
  }
}

export function summarizeDecisions(decisions) {
  const answered = decisions.filter((decision) => !decision.timedOut)
  return {
    accuracy: decisions.length
      ? decisions.filter((decision) => decision.isCorrect).length / decisions.length
      : 0,
    optimalRate: decisions.length
      ? decisions.filter((decision) => decision.isOptimal).length / decisions.length
      : 0,
    averageReactionTime: Math.round(average(answered.map((decision) => decision.reactionTimeMs))),
    correct: decisions.filter((decision) => decision.isCorrect).length,
    optimal: decisions.filter((decision) => decision.isOptimal).length,
    missed: decisions.filter((decision) => decision.timedOut).length,
  }
}
