export const TOTAL_ROUNDS = 30

export const GAME_META = {
  cards: {
    label: 'Cartes cachées',
    eyebrow: 'Probabilité simple',
    category: 'intuition',
    color: 'red',
  },
  dice: {
    label: 'Supérieur ou inférieur',
    eyebrow: 'Distribution',
    category: 'intuition',
    color: 'blue',
  },
  bag: {
    label: 'Le sac de couleurs',
    eyebrow: 'Fréquences',
    category: 'intuition',
    color: 'violet',
  },
  boxes: {
    label: 'La meilleure boîte',
    eyebrow: 'Comparaison de ratios',
    category: 'uncertainty',
    color: 'amber',
  },
  dots: {
    label: 'La ligne de points',
    eyebrow: 'Estimation éclair',
    category: 'estimation',
    color: 'green',
  },
  fireflies: {
    label: 'Les lucioles',
    eyebrow: 'Signal collectif',
    category: 'intuition',
    color: 'red',
  },
  hands: {
    label: 'Quelle main ?',
    eyebrow: 'Comportement implicite',
    category: 'adaptation',
    color: 'violet',
  },
  doors: {
    label: 'Les trois portes',
    eyebrow: 'Apprentissage caché',
    category: 'adaptation',
    color: 'amber',
  },
  path: {
    label: 'Le chemin vivant',
    eyebrow: 'Flux probable',
    category: 'intuition',
    color: 'blue',
  },
  risk: {
    label: 'Continuer ou partir',
    eyebrow: 'Décision sous tension',
    category: 'risk',
    color: 'red',
  },
}

const clamp = (value, minimum = 0, maximum = 1) => (
  Math.min(maximum, Math.max(minimum, value))
)

const randomInteger = (minimum, maximum) => (
  Math.floor(Math.random() * (maximum - minimum + 1)) + minimum
)

const choose = (items) => items[randomInteger(0, items.length - 1)]

const shuffle = (items) => {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = randomInteger(0, index)
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

const weightedIndex = (weights) => {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let cursor = Math.random() * total
  for (let index = 0; index < weights.length; index += 1) {
    cursor -= weights[index]
    if (cursor <= 0) return index
  }
  return weights.length - 1
}

const formatPercent = (value) => `${Math.round(value * 100)} %`

const weightedChoice = (items, weights) => items[weightedIndex(weights)]

const makeBinaryHistory = (probability, length = 5) => (
  [...Array(length)].map(() => Math.random() < probability)
)

function longestRun(values) {
  let longest = 0
  let current = 0
  let previous = null
  values.forEach((value) => {
    current = value === previous ? current + 1 : 1
    previous = value
    longest = Math.max(longest, current)
  })
  return longest
}

function makeHandHistory(dominant, bias, length = 6) {
  const other = dominant === 'left' ? 'right' : 'left'
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const history = [...Array(length)].map(() => Math.random() < bias ? dominant : other)
    const dominantCount = history.filter((side) => side === dominant).length
    if (dominantCount >= 3 && dominantCount <= 4 && longestRun(history) <= 3) return history
  }
  return Math.random() < 0.5
    ? [dominant, dominant, other, dominant, dominant, other]
    : [other, dominant, dominant, other, dominant, dominant]
}

export function createSessionContext() {
  const dominantHand = Math.random() < 0.5 ? 'left' : 'right'
  const handBias = 0.6 + Math.random() * 0.12
  const doorRates = shuffle([0.34 + Math.random() * 0.08, 0.56 + Math.random() * 0.08, 0.76 + Math.random() * 0.09])
  return {
    hand: {
      dominant: dominantHand,
      bias: handBias,
      history: makeHandHistory(dominantHand, handBias),
      visits: 0,
    },
    doors: {
      rates: doorRates,
      history: doorRates.map((rate) => makeBinaryHistory(rate, 5)),
      visits: 0,
    },
    risk: {
      run: 0,
      recent: [],
    },
  }
}

const baseRound = (type, level, difficulty, durationMs) => ({
  id: `${Date.now()}-${level}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  level,
  difficulty,
  durationMs,
  meta: GAME_META[type],
})

function generateCards(level, difficulty, durationMs) {
  const count = Math.min(10, 3 + Math.floor(difficulty * 7))
  const candidates = difficulty < 0.35
    ? [Math.max(1, count - 1), Math.ceil(count * 0.66)]
    : [1, Math.floor(count / 2), Math.ceil(count * 0.66), count - 1]
  const winners = clamp(choose(candidates), 1, count - 1)
  const winningPositions = new Set(shuffle([...Array(count).keys()]).slice(0, winners))
  const choices = [...Array(count).keys()].map((position) => ({
    id: String(position),
    label: `Carte ${position + 1}`,
  }))
  const probability = winners / count

  return {
    ...baseRound('cards', level, difficulty, durationMs),
    prompt: 'Choisis une carte rouge.',
    supportingText: `${winners} carte${winners > 1 ? 's' : ''} rouge${winners > 1 ? 's' : ''} sur ${count}`,
    choices,
    optimalOption: null,
    correctOption: null,
    targetProbability: probability,
    uncertainty: 1 - Math.abs(probability - 0.5) * 2,
    visual: {count, winners, winningPositions: [...winningPositions]},
    resolve(selectedOption) {
      const isCorrect = winningPositions.has(Number(selectedOption))
      return {
        correctOption: selectedOption,
        isCorrect,
        isOptimal: true,
        resultTitle: isCorrect ? 'Carte rouge.' : 'Carte verte.',
        resultDetail: isCorrect
          ? `${formatPercent(probability)} de chance — le tirage te sourit.`
          : `Le choix était défendable : chaque carte avait ${formatPercent(probability)} de chance.`,
        reveal: {winningPositions: [...winningPositions], selectedOption},
      }
    },
  }
}

function diceDistribution(diceCount, sides, reference) {
  let distribution = new Map([[0, 1]])
  for (let die = 0; die < diceCount; die += 1) {
    const next = new Map()
    for (const [sum, frequency] of distribution) {
      for (let face = 1; face <= sides; face += 1) {
        next.set(sum + face, (next.get(sum + face) || 0) + frequency)
      }
    }
    distribution = next
  }
  const totals = {lower: 0, equal: 0, higher: 0}
  for (const [sum, frequency] of distribution) {
    if (sum < reference) totals.lower += frequency
    else if (sum === reference) totals.equal += frequency
    else totals.higher += frequency
  }
  return totals
}

function generateDice(level, difficulty, durationMs) {
  const diceCount = difficulty > 0.72 ? 4 : difficulty > 0.3 ? 3 : 2
  const sides = difficulty > 0.6 ? choose([6, 8, 10]) : 6
  const rolls = [...Array(diceCount)].map(() => randomInteger(1, sides))
  const total = rolls.reduce((sum, value) => sum + value, 0)
  const expected = diceCount * (sides + 1) / 2
  const spread = Math.max(1, Math.round((1 - difficulty) * sides * 0.45))
  let reference = Math.round(expected + randomInteger(-spread, spread))
  reference = Math.max(diceCount + 1, Math.min(diceCount * sides - 1, reference))
  const outcome = total < reference ? 'lower' : total > reference ? 'higher' : 'equal'
  const probabilities = diceDistribution(diceCount, sides, reference)
  const optimalOption = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0]
  const sortedProbabilities = Object.values(probabilities).sort((a, b) => b - a)
  const probabilityTotal = sortedProbabilities.reduce((sum, value) => sum + value, 0)
  const gap = (sortedProbabilities[0] - sortedProbabilities[1]) / probabilityTotal

  return {
    ...baseRound('dice', level, difficulty, durationMs),
    prompt: `La somme est-elle strictement inférieure, égale ou supérieure à ${reference} ?`,
    supportingText: `${diceCount} dés à ${sides} faces ont été lancés.`,
    choices: [
      {id: 'lower', label: 'Inférieur'},
      {id: 'equal', label: 'Égal'},
      {id: 'higher', label: 'Supérieur'},
    ],
    correctOption: outcome,
    optimalOption,
    targetProbability: probabilities[optimalOption] / probabilityTotal,
    uncertainty: clamp(1 - gap * 3),
    visual: {diceCount, sides, rolls, reference},
    resolve(selectedOption) {
      const isCorrect = selectedOption === outcome
      const isOptimal = selectedOption === optimalOption
      return {
        correctOption: outcome,
        isCorrect,
        isOptimal,
        resultTitle: `${rolls.join(' + ')} = ${total}`,
        resultDetail: isCorrect
          ? 'Tu as correctement anticipé le résultat caché.'
          : isOptimal
            ? 'Le résultat te contredit, mais ton choix restait le plus probable.'
            : `Le résultat était ${outcome === 'lower' ? 'inférieur' : outcome === 'higher' ? 'supérieur' : 'égal'}.`,
        reveal: {rolls, total, reference},
      }
    },
  }
}

const BAG_COLORS = [
  {id: 'red', label: 'Rouge'},
  {id: 'blue', label: 'Bleu'},
  {id: 'amber', label: 'Jaune'},
]

function generateBag(level, difficulty, durationMs) {
  const colorCount = difficulty > 0.35 ? 3 : 2
  const colors = BAG_COLORS.slice(0, colorCount)
  const maximum = 8 + Math.floor(difficulty * 8)
  let counts = colors.map(() => randomInteger(2, maximum))
  if (difficulty < 0.3) {
    const dominant = randomInteger(0, colorCount - 1)
    counts = counts.map((count, index) => index === dominant ? maximum + 4 : Math.max(1, Math.floor(count / 2)))
  }
  const drawnIndex = weightedIndex(counts)
  const dominantIndex = counts.indexOf(Math.max(...counts))
  const sortedCounts = [...counts].sort((a, b) => b - a)
  const countTotal = counts.reduce((sum, count) => sum + count, 0)
  const gap = (sortedCounts[0] - sortedCounts[1]) / countTotal

  return {
    ...baseRound('bag', level, difficulty, durationMs),
    prompt: 'Quelle couleur va sortir du sac ?',
    supportingText: 'Une bille a été tirée. Elle reste cachée.',
    choices: colors.map((color) => ({id: color.id, label: color.label})),
    correctOption: colors[drawnIndex].id,
    optimalOption: colors[dominantIndex].id,
    targetProbability: counts[dominantIndex] / countTotal,
    uncertainty: clamp(1 - gap * 4),
    visual: {
      colors: colors.map((color, index) => ({...color, count: counts[index]})),
      drawn: colors[drawnIndex],
    },
    resolve(selectedOption) {
      const isCorrect = selectedOption === colors[drawnIndex].id
      const isOptimal = selectedOption === colors[dominantIndex].id
      return {
        correctOption: colors[drawnIndex].id,
        isCorrect,
        isOptimal,
        resultTitle: `La bille est ${colors[drawnIndex].label.toLowerCase()}.`,
        resultDetail: isCorrect
          ? 'Ton intuition rencontre le tirage réel.'
          : isOptimal
            ? 'Choix rationnel, tirage défavorable : la meilleure décision ne garantit jamais l’issue.'
            : `${colors[dominantIndex].label} offrait la meilleure fréquence (${counts[dominantIndex]} sur ${countTotal}).`,
        reveal: {drawn: colors[drawnIndex]},
      }
    },
  }
}

function makeRatio(difficulty) {
  const denominator = randomInteger(difficulty > 0.6 ? 12 : 5, difficulty > 0.6 ? 30 : 14)
  const numerator = randomInteger(1, denominator - 1)
  return {numerator, denominator, ratio: numerator / denominator}
}

function generateBoxes(level, difficulty, durationMs) {
  let left = makeRatio(difficulty)
  let right = makeRatio(difficulty)
  const desiredGap = 0.24 - difficulty * 0.19
  let safety = 0
  while ((Math.abs(left.ratio - right.ratio) < desiredGap || left.ratio === right.ratio) && safety < 80) {
    right = makeRatio(difficulty)
    safety += 1
  }
  if (left.ratio === right.ratio) {
    right = {numerator: Math.max(1, right.numerator - 1), denominator: right.denominator}
    right.ratio = right.numerator / right.denominator
  }
  const correctOption = left.ratio > right.ratio ? 'left' : 'right'
  const best = correctOption === 'left' ? left : right
  const other = correctOption === 'left' ? right : left

  return {
    ...baseRound('boxes', level, difficulty, durationMs),
    prompt: 'Quelle boîte offre la meilleure chance de gagner ?',
    supportingText: difficulty > 0.55
      ? 'Les tailles diffèrent. Compare les proportions, pas les quantités.'
      : 'Choisis la proportion la plus favorable.',
    choices: [
      {id: 'left', label: 'Boîte A'},
      {id: 'right', label: 'Boîte B'},
    ],
    correctOption,
    optimalOption: correctOption,
    targetProbability: best.ratio,
    uncertainty: clamp(1 - Math.abs(left.ratio - right.ratio) * 4),
    visual: {left, right},
    resolve(selectedOption) {
      const isCorrect = selectedOption === correctOption
      return {
        correctOption,
        isCorrect,
        isOptimal: isCorrect,
        resultTitle: `Boîte ${correctOption === 'left' ? 'A' : 'B'} : ${formatPercent(best.ratio)}.`,
        resultDetail: `L’autre boîte offrait ${formatPercent(other.ratio)}. ${isCorrect ? 'Comparaison juste.' : 'Le dénominateur a peut-être attiré ton regard.'}`,
        reveal: {left, right},
      }
    },
  }
}

function dotPositions(count) {
  const points = []
  for (let index = 0; index < count; index += 1) {
    points.push({
      x: 4 + Math.random() * 92,
      y: 7 + Math.random() * 86,
      size: 3 + Math.random() * 4,
      tone: Math.random() > 0.22 ? 'light' : 'red',
    })
  }
  return points
}

function generateDots(level, difficulty, durationMs) {
  const count = randomInteger(16 + Math.floor(difficulty * 20), 34 + Math.floor(difficulty * 42))
  const gap = Math.max(3, Math.round(8 - difficulty * 5))
  const correctIndex = randomInteger(0, 3)
  const values = [-2, -1, 0, 1].map((offset) => count + (offset - correctIndex + 2) * gap)
  values[correctIndex] = count
  const unique = [...new Set(values.map((value) => Math.max(1, value)))]
  while (unique.length < 4) unique.push(unique[unique.length - 1] + gap)
  const choices = shuffle(unique).map((value) => ({id: String(value), label: String(value)}))

  return {
    ...baseRound('dots', level, difficulty, durationMs),
    prompt: 'Combien de points as-tu vus ?',
    supportingText: 'L’image disparaît en un instant. Ne compte pas.',
    choices,
    correctOption: String(count),
    optimalOption: String(count),
    targetProbability: null,
    uncertainty: clamp(difficulty * 0.75 + 0.2),
    visual: {count, points: dotPositions(count), visibleMs: Math.round(1100 - difficulty * 450)},
    resolve(selectedOption) {
      const selectedValue = Number(selectedOption)
      const closestDistance = Math.min(...choices.map((choice) => Math.abs(Number(choice.id) - count)))
      const isCorrect = Math.abs(selectedValue - count) === closestDistance
      const errorPercent = Math.round(Math.abs(selectedValue - count) / count * 100)
      return {
        correctOption: String(count),
        isCorrect,
        isOptimal: isCorrect,
        resultTitle: `${count} points.`,
        resultDetail: isCorrect
          ? `Estimation précise${errorPercent ? ` à ${errorPercent} % près` : ''}.`
          : `Ton estimation s’écarte de ${errorPercent} %.`,
        reveal: {count},
      }
    },
  }
}

const EXIT_ZONES = [
  {id: 'left', label: 'Clairière gauche'},
  {id: 'center', label: 'Passage central'},
  {id: 'right', label: 'Clairière droite'},
]

function makeFireflies(driftZone, difficulty) {
  const zoneX = {left: 22, center: 50, right: 78}[driftZone]
  return [...Array(34)].map((_, index) => {
    const signal = Math.random() > 0.22 + difficulty * 0.2
    const startX = 8 + Math.random() * 84
    const startY = 12 + Math.random() * 70
    const targetX = signal ? zoneX + (Math.random() - 0.5) * 23 : 8 + Math.random() * 84
    return {
      x: startX,
      y: startY,
      dx: targetX - startX,
      dy: 18 + Math.random() * 26,
      size: 2.5 + Math.random() * 4,
      delay: -Math.random() * 1.8,
      duration: 1.5 + Math.random() * 1.35,
      bright: index % 5 === 0,
    }
  })
}

function generateFireflies(level, difficulty, durationMs) {
  const driftIndex = randomInteger(0, 2)
  const driftZone = EXIT_ZONES[driftIndex].id
  const signalStrength = 0.72 - difficulty * 0.2
  const sideWeight = (1 - signalStrength) / 2
  const weights = [sideWeight, sideWeight, sideWeight]
  weights[driftIndex] = signalStrength
  const actualZone = weightedChoice(EXIT_ZONES, weights)
  const sorted = [...weights].sort((a, b) => b - a)

  return {
    ...baseRound('fireflies', level, difficulty, durationMs),
    prompt: 'Par où le nuage va-t-il sortir ?',
    supportingText: 'Regarde le mouvement d’ensemble, pas une luciole isolée.',
    choices: EXIT_ZONES,
    correctOption: actualZone.id,
    optimalOption: driftZone,
    targetProbability: signalStrength,
    uncertainty: clamp(1 - (sorted[0] - sorted[1]) * 2),
    visual: {
      fireflies: makeFireflies(driftZone, difficulty),
      driftZone,
      actualZone: actualZone.id,
    },
    resolve(selectedOption) {
      const isCorrect = selectedOption === actualZone.id
      const isOptimal = selectedOption === driftZone
      return {
        correctOption: actualZone.id,
        isCorrect,
        isOptimal,
        resultTitle: `Le nuage sort ${actualZone.id === 'left' ? 'à gauche' : actualZone.id === 'right' ? 'à droite' : 'au centre'}.`,
        resultDetail: isCorrect
          ? 'Tu as lu le mouvement collectif avant la dispersion.'
          : isOptimal
            ? 'Tu avais suivi la tendance dominante, mais quelques lucioles ont emporté le nuage ailleurs.'
            : `Le courant principal penchait vers ${driftZone === 'left' ? 'la gauche' : driftZone === 'right' ? 'la droite' : 'le centre'}.`,
      }
    },
  }
}

function generateHands(level, difficulty, durationMs, context) {
  const model = context?.hand || createSessionContext().hand
  const visit = Number.isInteger(model.visits) ? model.visits : 0
  const shifted = visit >= 2
  const effectiveDominant = shifted
    ? model.dominant === 'left' ? 'right' : 'left'
    : model.dominant
  const effectiveBias = shifted ? 0.62 : model.bias
  const actualSide = Math.random() < effectiveBias
    ? effectiveDominant
    : effectiveDominant === 'left' ? 'right' : 'left'
  const history = [...model.history].slice(-7)
  model.history.push(actualSide)
  model.history = model.history.slice(-8)
  model.visits = visit + 1

  return {
    ...baseRound('hands', level, difficulty, durationMs),
    prompt: 'Dans quelle main l’objet est-il caché ?',
    supportingText: shifted
      ? 'Le personnage semble avoir changé quelque chose.'
      : 'Observe ses habitudes récentes, puis fais confiance à ton impression.',
    choices: [
      {id: 'left', label: 'Main gauche'},
      {id: 'right', label: 'Main droite'},
    ],
    correctOption: actualSide,
    optimalOption: effectiveDominant,
    targetProbability: effectiveBias,
    uncertainty: clamp(1 - (effectiveBias - 0.5) * 3.5),
    visual: {history, actualSide, shifted},
    resolve(selectedOption) {
      const isCorrect = selectedOption === actualSide
      const isOptimal = selectedOption === effectiveDominant
      return {
        correctOption: actualSide,
        isCorrect,
        isOptimal,
        resultTitle: `L’objet était ${actualSide === 'left' ? 'à gauche' : 'à droite'}.`,
        resultDetail: isCorrect
          ? 'Tu as capté son comportement.'
          : isOptimal
            ? 'Tu as suivi son habitude dominante, mais il a dévié cette fois.'
            : shifted
              ? 'Son comportement vient de basculer : l’ancienne habitude devient moins fiable.'
              : `Ses derniers gestes favorisaient plutôt ${effectiveDominant === 'left' ? 'la gauche' : 'la droite'}.`,
      }
    },
  }
}

function generateDoors(level, difficulty, durationMs, context) {
  const model = context?.doors || createSessionContext().doors
  if (model.visits === 2 && level >= 20) {
    model.rates = [model.rates[2], model.rates[0], model.rates[1]]
  }
  model.visits += 1
  const bestIndex = model.rates.indexOf(Math.max(...model.rates))
  const sortedRates = [...model.rates].sort((a, b) => b - a)
  const choices = ['A', 'B', 'C'].map((label, index) => ({id: String(index), label: `Porte ${label}`}))

  return {
    ...baseRound('doors', level, difficulty, durationMs),
    prompt: 'Quelle porte te semble la plus généreuse ?',
    supportingText: 'Les lumières montrent les résultats récents. La règle reste cachée.',
    choices,
    correctOption: null,
    optimalOption: String(bestIndex),
    targetProbability: model.rates[bestIndex],
    uncertainty: clamp(1 - (sortedRates[0] - sortedRates[1]) * 3),
    visual: {
      histories: model.history.map((items) => [...items].slice(-6)),
      rates: [...model.rates],
    },
    resolve(selectedOption) {
      const selectedIndex = Number(selectedOption)
      const rewarded = Math.random() < model.rates[selectedIndex]
      model.history[selectedIndex].push(rewarded)
      model.history[selectedIndex] = model.history[selectedIndex].slice(-6)
      const isOptimal = selectedIndex === bestIndex
      return {
        correctOption: rewarded ? selectedOption : null,
        isCorrect: rewarded,
        isOptimal,
        rewarded,
        resultTitle: rewarded ? 'La lumière s’allume.' : 'La porte reste silencieuse.',
        resultDetail: rewarded
          ? isOptimal
            ? 'Ton apprentissage et le résultat vont dans le même sens.'
            : 'Cette porte récompense ton audace, même si une autre restait plus régulière.'
          : isOptimal
            ? 'La meilleure porte peut aussi rester vide. La fréquence se révèle sur plusieurs essais.'
            : `La porte ${String.fromCharCode(65 + bestIndex)} montrait le signal le plus stable.`,
      }
    },
  }
}

function generatePath(level, difficulty, durationMs) {
  const rawWeights = [...Array(3)].map(() => 0.18 + Math.random() * 0.72)
  if (difficulty < 0.35) rawWeights[randomInteger(0, 2)] += 0.65
  const weightTotal = rawWeights.reduce((sum, value) => sum + value, 0)
  const weights = rawWeights.map((value) => value / weightTotal)
  const actualIndex = weightedIndex(weights)
  const bestIndex = weights.indexOf(Math.max(...weights))
  const sorted = [...weights].sort((a, b) => b - a)

  return {
    ...baseRound('path', level, difficulty, durationMs),
    prompt: 'Où la bille va-t-elle terminer sa course ?',
    supportingText: 'Lis la respiration des chemins : leur largeur est un indice.',
    choices: EXIT_ZONES.map((zone) => ({
      id: zone.id,
      label: zone.id === 'left' ? 'Zone gauche' : zone.id === 'right' ? 'Zone droite' : 'Zone centrale',
    })),
    correctOption: EXIT_ZONES[actualIndex].id,
    optimalOption: EXIT_ZONES[bestIndex].id,
    targetProbability: weights[bestIndex],
    uncertainty: clamp(1 - (sorted[0] - sorted[1]) * 3),
    visual: {
      weights,
      actualZone: EXIT_ZONES[actualIndex].id,
      pathId: `living-path-${level}-${Math.random().toString(36).slice(2, 6)}`,
    },
    resolve(selectedOption) {
      const isCorrect = selectedOption === EXIT_ZONES[actualIndex].id
      const isOptimal = selectedOption === EXIT_ZONES[bestIndex].id
      return {
        correctOption: EXIT_ZONES[actualIndex].id,
        isCorrect,
        isOptimal,
        resultTitle: `Arrivée ${actualIndex === 0 ? 'à gauche' : actualIndex === 2 ? 'à droite' : 'au centre'}.`,
        resultDetail: isCorrect
          ? 'Tu as anticipé le flux jusqu’à sa sortie.'
          : isOptimal
            ? 'Tu avais choisi le passage le plus large ; la bille a emprunté une branche secondaire.'
            : `Le courant le plus fort allait vers ${bestIndex === 0 ? 'la gauche' : bestIndex === 2 ? 'la droite' : 'le centre'}.`,
      }
    },
  }
}

function generateRisk(level, difficulty, durationMs, context) {
  const model = context?.risk || createSessionContext().risk
  const step = Math.min(7, 2 + model.run + Math.floor(difficulty * 3))
  const bank = 70 + step * step * 24
  const nextBank = 70 + (step + 1) * (step + 1) * 24
  const survivalChance = clamp(0.9 - step * 0.075 - difficulty * 0.08, 0.28, 0.82)
  const expectedContinue = survivalChance * nextBank
  const optimalOption = expectedContinue > bank ? 'continue' : 'leave'
  const survives = Math.random() < survivalChance

  return {
    ...baseRound('risk', level, difficulty, durationMs),
    prompt: 'Tu encaisses maintenant ou tu tentes encore un palier ?',
    supportingText: 'Le gain monte. La stabilité de la tour, elle, diminue.',
    choices: [
      {id: 'leave', label: `Partir avec ${bank} pts`},
      {id: 'continue', label: 'Continuer'},
    ],
    correctOption: null,
    optimalOption,
    targetProbability: survivalChance,
    uncertainty: clamp(1 - Math.abs(expectedContinue - bank) / Math.max(bank, expectedContinue) * 2),
    visual: {
      step,
      bank,
      nextBank,
      survives,
      recent: [...model.recent].slice(-5),
    },
    resolve(selectedOption) {
      const continued = selectedOption === 'continue'
      const isCorrect = continued ? survives : true
      const isOptimal = selectedOption === optimalOption
      const outcome = continued ? (survives ? 'survived' : 'crashed') : 'banked'
      model.run = outcome === 'survived' ? Math.min(5, model.run + 1) : 0
      model.recent.push(outcome)
      model.recent = model.recent.slice(-6)
      return {
        correctOption: survives ? 'continue' : 'leave',
        isCorrect,
        isOptimal,
        riskOutcome: outcome,
        resultTitle: outcome === 'banked'
          ? `${bank} points sécurisés.`
          : outcome === 'survived'
            ? `Palier franchi : ${nextBank} points.`
            : 'La tour s’effondre.',
        resultDetail: outcome === 'banked'
          ? isOptimal
            ? 'Ton seuil de sortie protège la valeur accumulée.'
            : 'Tu sécurises le gain, même si la tentative restait encore rentable en moyenne.'
          : outcome === 'survived'
            ? isOptimal
              ? 'Risque rentable, intuition récompensée.'
              : 'Le pari passe cette fois, malgré une valeur moyenne moins favorable.'
            : isOptimal
              ? 'Le risque était cohérent en moyenne, mais cette tentative échoue.'
              : 'La tension avait dépassé la valeur probable du palier suivant.',
      }
    },
  }
}

const GENERATORS = {
  cards: generateCards,
  dice: generateDice,
  bag: generateBag,
  boxes: generateBoxes,
  dots: generateDots,
  fireflies: generateFireflies,
  hands: generateHands,
  doors: generateDoors,
  path: generatePath,
  risk: generateRisk,
}

export function createRoundOrder(total = TOTAL_ROUNDS) {
  const types = Object.keys(GENERATORS)
  const order = []
  while (order.length < total) {
    const batch = shuffle(types)
    if (order.length && batch[0] === order.at(-1)) {
      ;[batch[0], batch[1]] = [batch[1], batch[0]]
    }
    order.push(...batch)
  }
  return order.slice(0, total)
}

export function computeAdaptiveDifficulty(level, recentDecisions = []) {
  const base = (level - 1) / (TOTAL_ROUNDS - 1)
  const recent = recentDecisions.slice(-5)
  if (recent.length < 3) return clamp(base)
  const accuracy = recent.filter((decision) => decision.isOptimal).length / recent.length
  const speed = recent.reduce((sum, decision) => sum + decision.reactionTimeMs / decision.durationMs, 0) / recent.length
  const adjustment = accuracy >= 0.8 && speed < 0.58
    ? 0.1
    : accuracy <= 0.4
      ? -0.1
      : 0
  return clamp(base + adjustment)
}

export function generateRound(type, level, recentDecisions = [], context = createSessionContext()) {
  const difficulty = computeAdaptiveDifficulty(level, recentDecisions)
  const durationMs = 10000
  return GENERATORS[type](level, difficulty, durationMs, context)
}

export function scoreDecision({round, resolution, reactionTimeMs, streak}) {
  const speedRatio = clamp(1 - reactionTimeMs / round.durationMs)
  const speedBonus = Math.round(speedRatio * 90)
  const difficultyBonus = Math.round(round.difficulty * 110)
  const streakBonus = Math.min(120, streak * 12)
  const outcomePoints = resolution.isCorrect ? 100 + speedBonus + difficultyBonus + streakBonus : 0
  const strategyPoints = !resolution.isCorrect && resolution.isOptimal ? 35 : 0
  return {
    total: outcomePoints + strategyPoints,
    outcomePoints,
    strategyPoints,
    speedBonus,
    difficultyBonus,
    streakBonus,
  }
}

export function stageForLevel(level) {
  if (level <= 6) return {index: 1, label: 'Intuition simple'}
  if (level <= 12) return {index: 2, label: 'Estimation'}
  if (level <= 18) return {index: 3, label: 'Incertitude'}
  if (level <= 24) return {index: 4, label: 'Adaptation'}
  return {index: 5, label: 'Décisions critiques'}
}
