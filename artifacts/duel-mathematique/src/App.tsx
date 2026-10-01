import './game.css';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Check,
  Clock3,
  Delete,
  Equal,
  RotateCcw,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';

type Difficulty = 'Facile' | 'Moyen' | 'Difficile' | 'Expert';
type TeamKey = 'blue' | 'red';
type Phase = 'setup' | 'playing' | 'reveal' | 'finished';
type TeamAnswers = Record<TeamKey, string>;
type TeamSubmissions = Record<TeamKey, string | null>;

const TEAM_NAMES: Record<TeamKey, string> = {
  blue: 'Équipe Bleue',
  red: 'Équipe Rouge',
};
const DIFFICULTIES: Array<{ name: Difficulty; detail: string; range: string; mark: string }> = [
  { name: 'Facile', detail: 'Les bases, sans piège.', range: 'Petits nombres', mark: '01' },
  { name: 'Moyen', detail: 'La priorité des opérations.', range: 'Calcul mental', mark: '02' },
  { name: 'Difficile', detail: 'Parenthèses en jeu.', range: 'Étape par étape', mark: '03' },
  { name: 'Expert', detail: 'À vous de jouer tactique.', range: 'Grand défi', mark: '04' },
];

function tokenize(source: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }
    if (/[0-9]/.test(char)) {
      let end = i + 1;
      while (end < source.length && /[0-9]/.test(source[end])) end += 1;
      tokens.push(source.slice(i, end));
      i = end;
      continue;
    }
    if ('+-−×*÷/()[]'.includes(char)) {
      tokens.push(char);
      i += 1;
      continue;
    }
    throw new Error('Caractère non autorisé');
  }
  return tokens;
}

/** A small recursive-descent parser: no eval, with normal arithmetic precedence. */
function evaluateExpression(source: string, steps?: string[]): number {
  const tokens = tokenize(source);
  if (!tokens.length) throw new Error('Expression vide');
  let cursor = 0;
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];
  const formatStep = (value: number) => String(Number(value.toFixed(4)));
  const parsePrimary = (): number => {
    const token = take();
    if (token === '+' || token === '-' || token === '−') {
      const value = parsePrimary();
      return token === '+' ? value : -value;
    }
    if (token === '(' || token === '[') {
      const closing = token === '(' ? ')' : ']';
      const contentStart = cursor;
      const result = parseSum();
      const content = tokens.slice(contentStart, cursor).join(' ');
      if (take() !== closing) throw new Error('Parenthèse manquante');
      steps?.push(`${token}${content}${closing} = ${formatStep(result)}`);
      return result;
    }
    if (!token || !/^\d+$/.test(token)) throw new Error('Nombre attendu');
    return Number(token);
  };
  const parseProduct = (): number => {
    let value = parsePrimary();
    while (peek() === '×' || peek() === '*' || peek() === '÷' || peek() === '/') {
      const operator = take();
      const right = parsePrimary();
      if ((operator === '÷' || operator === '/') && right === 0) throw new Error('Division par zéro');
      const left = value;
      value = operator === '×' || operator === '*' ? value * right : value / right;
      steps?.push(`${formatStep(left)} ${operator === '*' ? '×' : operator === '/' ? '÷' : operator} ${formatStep(right)} = ${formatStep(value)}`);
    }
    return value;
  };
  const parseSum = (): number => {
    let value = parseProduct();
    while (peek() === '+' || peek() === '-' || peek() === '−') {
      const operator = take();
      const right = parseProduct();
      const left = value;
      value = operator === '+' ? value + right : value - right;
      steps?.push(`${formatStep(left)} ${operator === '−' ? '−' : operator} ${formatStep(right)} = ${formatStep(value)}`);
    }
    return value;
  };
  const answer = parseSum();
  if (cursor !== tokens.length || !Number.isFinite(answer)) throw new Error('Expression incomplète');
  return answer;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeSetting(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function generateQuestion(difficulty: Difficulty): { expression: string; answer: number } {
  const ranges: Record<Difficulty, [number, number]> = {
    Facile: [2, 8],
    Moyen: [3, 14],
    Difficile: [5, 22],
    Expert: [8, 36],
  };
  const [min, max] = ranges[difficulty];
  const limit = difficulty === 'Facile' ? 250 : difficulty === 'Moyen' ? 900 : 2400;
  for (let attempt = 0; attempt < 900; attempt += 1) {
    const a = randomInt(min, max);
    const b = randomInt(min, max);
    const c = randomInt(2, difficulty === 'Expert' ? 12 : 8);
    const d = randomInt(min, max);
    const e = randomInt(2, difficulty === 'Facile' ? 6 : 12);
    const template = randomInt(0, 2);
    let expression: string;
    if (template === 0) expression = `${a} + (${b} × ${c}) − ${d}`;
    else if (template === 1) expression = `[${a} − ${b}] × ${c} + ${d}`;
    else expression = `([${a} + ${b}] × ${c}) ÷ ${d} − ${e}`;
    try {
      const answer = evaluateExpression(expression);
      if (Number.isInteger(answer) && Math.abs(answer) <= limit) return { expression, answer };
    } catch {
      // A generated expression is retried if it is not valid.
    }
  }
  return { expression: '([6 + 6] × 2 − 12) ÷ 4', answer: 3 };
}

function ScoreValue({ value, animation }: { value: number; animation: string }) {
  return (
    <span key={`${value}-${animation}`} className={`score-value mono ${animation}`} aria-live="polite" data-testid="text-score">
      {value}
    </span>
  );
}

function CalculatorPad({
  team,
  value,
  setValue,
  result,
  setResult,
  onCopy,
}: {
  team: TeamKey;
  value: string;
  setValue: (value: string) => void;
  result: string;
  setResult: (value: string) => void;
  onCopy: () => void;
}) {
  const [error, setError] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const keypad = [
    ['7', '8', '9', '÷'],
    ['4', '5', '6', '×'],
    ['1', '2', '3', '−'],
    ['0', '(', ')', '+'],
    ['[', ']', '⌫', '='],
  ];
  const append = (key: string) => {
    setError('');
    if (key === '⌫') {
      setValue(value.slice(0, -1));
      setResult('');
      setSteps([]);
      return;
    }
    if (key === '=') {
      try {
        const nextSteps: string[] = [];
        const computed = evaluateExpression(value, nextSteps);
        setResult(String(Number.isInteger(computed) ? computed : Number(computed.toFixed(4))));
        setSteps(nextSteps);
      } catch {
        setError('À vérifier');
        setResult('');
        setSteps([]);
      }
      return;
    }
    setValue(`${value}${key}`);
    setResult('');
    setSteps([]);
  };
  const updateFromKeyboard = (next: string) => {
    setError('');
    setValue(next.replace(/[^0-9+\-−×*÷/()[\]\s]/g, ''));
    setResult('');
    setSteps([]);
  };
  return (
    <section className="calc-block" aria-label={`Calculatrice de ${TEAM_NAMES[team]}`}>
      <div className="calc-heading">
        <span className="calc-heading-label"><Calculator size={14} strokeWidth={2.4} /> CALCULATRICE</span>
        <span className="calc-private">À VOUS</span>
      </div>
      <label className="sr-only" htmlFor={`calculator-${team}`}>Expression de calcul, équipe {team === 'blue' ? 'bleue' : 'rouge'}</label>
      <input
        id={`calculator-${team}`}
        data-testid={`input-calculator-${team}`}
        className="calc-display mono"
        value={value}
        onChange={(event) => updateFromKeyboard(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            append('=');
          }
        }}
        placeholder="Votre brouillon…"
        autoComplete="off"
        aria-describedby={`calc-result-${team}`}
      />
      <div className="calc-readout" id={`calc-result-${team}`} aria-live="polite">
        <span>{error || (result ? 'RÉSULTAT' : value ? 'EXPRESSION EN COURS' : 'SAISIR UNE OPÉRATION')}</span>
        <strong className="mono">{result || '—'}</strong>
      </div>
      {steps.length > 0 && (
        <ol className="calc-steps" aria-label={`Étapes du calcul, équipe ${team === 'blue' ? 'bleue' : 'rouge'}`}>
          {steps.map((step, index) => <li key={`${index}-${step}`} className="mono">{step}</li>)}
        </ol>
      )}
      <div className="calc-grid" role="group" aria-label="Touches de calculatrice">
        {keypad.flat().map((key, index) => (
          <button
            key={`${key}-${index}`}
            type="button"
            data-testid={`button-calculator-${team}-${key === '⌫' ? 'delete' : key === '=' ? 'equals' : index}`}
            aria-label={key === '⌫' ? 'Effacer le dernier caractère' : key === '=' ? 'Calculer le résultat' : `Ajouter ${key}`}
            onClick={() => append(key === '−' ? '-' : key)}
            className={`calc-key calc-key-button ${['÷', '×', '−', '+'].includes(key) ? 'calc-operator' : ''} ${key === '=' ? 'calc-equals' : ''}`}
          >
            {key === '⌫' ? <Delete size={17} /> : key === '=' ? <Equal size={18} /> : key}
          </button>
        ))}
        <button
          type="button"
          data-testid={`button-calculator-${team}-clear`}
          className="calc-clear"
          onClick={() => { setValue(''); setResult(''); setError(''); setSteps([]); }}
        >
          EFFACER
        </button>
        <button
          type="button"
          data-testid={`button-calculator-${team}-copy`}
          className="calc-copy"
          disabled={!result}
          onClick={onCopy}
          title="Copier le résultat dans votre réponse"
        >
          Copier vers réponse <ArrowRight size={13} />
        </button>
      </div>
    </section>
  );
}

function TeamPanel({
  team,
  score,
  answer,
  submitted,
  locked,
  animation,
  calcValue,
  setCalcValue,
  calcResult,
  setCalcResult,
  onAnswer,
  onSubmit,
  onCopy,
  message,
}: {
  team: TeamKey;
  score: number;
  answer: string;
  submitted: boolean;
  locked: boolean;
  animation: string;
  calcValue: string;
  setCalcValue: (value: string) => void;
  calcResult: string;
  setCalcResult: (value: string) => void;
  onAnswer: (value: string) => void;
  onSubmit: () => void;
  onCopy: () => void;
  message?: string;
}) {
  const isBlue = team === 'blue';
  return (
    <section className={`team-panel team-${team}`} aria-labelledby={`team-title-${team}`} data-testid={`panel-team-${team}`}>
      <header className="team-topline">
        <div className="team-identity">
          <span className="team-emblem" aria-hidden="true">{isBlue ? 'B' : 'R'}</span>
          <div>
            <p className="team-kicker">CAMP ÉQUIPE {isBlue ? '01' : '02'}</p>
            <h2 id={`team-title-${team}`}>{TEAM_NAMES[team]}</h2>
          </div>
        </div>
        <div className="score-stack">
          <span className="score-caption">POINTS</span>
          <ScoreValue value={score} animation={animation} />
        </div>
      </header>
      <div className="team-answer-area">
        <label className="answer-label" htmlFor={`answer-${team}`}>VOTRE RÉPONSE</label>
        <div className="answer-row">
          <input
            id={`answer-${team}`}
            data-testid={`input-answer-${team}`}
            className="team-input mono"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="?"
            value={answer}
            onChange={(event) => onAnswer(event.target.value.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, ''))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !locked && !submitted) onSubmit();
            }}
            disabled={locked || submitted}
            aria-label={`Réponse de ${TEAM_NAMES[team]}`}
          />
          <button
            type="button"
            data-testid={`button-submit-${team}`}
            className="team-button"
            disabled={locked || submitted || !answer.trim()}
            onClick={onSubmit}
          >
            {submitted ? <><Check size={16} /> VALIDÉE</> : <>ENVOYER LA RÉPONSE <ArrowRight size={14} /></>}
          </button>
        </div>
        <div className={`submission-status ${submitted ? 'is-submitted' : ''}`} aria-live="polite" data-testid={`status-submission-${team}`}>
          <span className="status-dot" />
          {submitted ? 'Réponse verrouillée — bien joué.' : 'Réponse secrète jusqu’au verdict.'}
        </div>
        {message && <p className="team-result-message" data-testid={`text-result-${team}`}>{message}</p>}
      </div>
      <CalculatorPad
        team={team}
        value={calcValue}
        setValue={setCalcValue}
        result={calcResult}
        setResult={setCalcResult}
        onCopy={onCopy}
      />
    </section>
  );
}

function App() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [difficulty, setDifficulty] = useState<Difficulty>('Moyen');
  const [round, setRound] = useState(1);
  const [questionCountInput, setQuestionCountInput] = useState('99');
  const [secondsPerQuestionInput, setSecondsPerQuestionInput] = useState('30');
  const [questionCount, setQuestionCount] = useState(99);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(30);
  const [question, setQuestion] = useState(() => generateQuestion('Moyen'));
  const [seconds, setSeconds] = useState(30);
  const [scores, setScores] = useState<Record<TeamKey, number>>({ blue: 0, red: 0 });
  const [answers, setAnswers] = useState<TeamAnswers>({ blue: '', red: '' });
  const [submissions, setSubmissions] = useState<TeamSubmissions>({ blue: null, red: null });
  const [calculatorValues, setCalculatorValues] = useState<TeamAnswers>({ blue: '', red: '' });
  const [calculatorResults, setCalculatorResults] = useState<TeamAnswers>({ blue: '', red: '' });
  const [scoreAnimations, setScoreAnimations] = useState<Record<TeamKey, string>>({ blue: '', red: '' });
  const [resultMessages, setResultMessages] = useState<Record<TeamKey, string>>({ blue: '', red: '' });
  const [roundEvents, setRoundEvents] = useState<string[]>([]);
  const [finalSnapshot, setFinalSnapshot] = useState<Record<TeamKey, number>>({ blue: 0, red: 0 });
  const resolvedRef = useRef(false);

  const beginGame = () => {
    const selectedQuestionCount = normalizeSetting(questionCountInput, 1, 99, 99);
    const selectedSeconds = normalizeSetting(secondsPerQuestionInput, 1, 300, 30);
    setQuestionCountInput(String(selectedQuestionCount));
    setSecondsPerQuestionInput(String(selectedSeconds));
    setQuestionCount(selectedQuestionCount);
    setSecondsPerQuestion(selectedSeconds);
    setScores({ blue: 0, red: 0 });
    setRound(1);
    setAnswers({ blue: '', red: '' });
    setSubmissions({ blue: null, red: null });
    setCalculatorValues({ blue: '', red: '' });
    setCalculatorResults({ blue: '', red: '' });
    setResultMessages({ blue: '', red: '' });
    setRoundEvents([]);
    setQuestion(generateQuestion(difficulty));
    setSeconds(selectedSeconds);
    resolvedRef.current = false;
    setPhase('playing');
  };

  const resolveRound = (submittedAnswers: TeamSubmissions) => {
    if (resolvedRef.current || phase !== 'playing') return;
    resolvedRef.current = true;
    const deltas: Record<TeamKey, number> = { blue: 0, red: 0 };
    const correct: Record<TeamKey, boolean> = { blue: false, red: false };
    const eventLines: string[] = [];
    const nextMessages: Record<TeamKey, string> = { blue: '', red: '' };

    (['blue', 'red'] as TeamKey[]).forEach((team) => {
      const other: TeamKey = team === 'blue' ? 'red' : 'blue';
      const response = submittedAnswers[team];
      if (response === null || response.trim() === '') {
        nextMessages[team] = 'Pas de réponse — aucun point perdu.';
        eventLines.push(`${TEAM_NAMES[team]} : sans réponse, aucun changement.`);
        return;
      }
      const numeric = Number(response);
      correct[team] = Number.isFinite(numeric) && numeric === question.answer;
      if (correct[team]) {
        deltas[team] += 1;
        nextMessages[team] = 'Bonne réponse : +1 point.';
        eventLines.push(`${TEAM_NAMES[team]} : bonne réponse, +1 point.`);
      } else {
        deltas[team] -= 1;
        deltas[other] += 1;
        nextMessages[team] = scores[team] === 0
          ? `Réponse incorrecte : score déjà à zéro ; +1 point transféré à ${TEAM_NAMES[other]}.`
          : `Réponse incorrecte : −1 point ; +1 point transféré à ${TEAM_NAMES[other]}.`;
        eventLines.push(`${TEAM_NAMES[team]} : réponse incorrecte, −1 point ; +1 point transféré à ${TEAM_NAMES[other]}.`);
      }
    });

    const nextScores: Record<TeamKey, number> = {
      blue: Math.max(0, scores.blue + deltas.blue),
      red: Math.max(0, scores.red + deltas.red),
    };
    const actualChanges = {
      blue: nextScores.blue - scores.blue,
      red: nextScores.red - scores.red,
    };
    const animationFor = (change: number) => change > 0 ? 'score-pop' : change < 0 ? 'score-drop' : 'score-hold';
    setScores(nextScores);
    setScoreAnimations({
      blue: animationFor(actualChanges.blue),
      red: animationFor(actualChanges.red),
    });
    setResultMessages(nextMessages);
    setRoundEvents(eventLines);
    setFinalSnapshot(nextScores);
    setPhase('reveal');
  };

  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const interval = window.setInterval(() => {
      setSeconds((remaining) => {
        if (remaining <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return remaining - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase === 'playing' && seconds === 0) resolveRound(submissions);
  }, [phase, seconds, submissions]);

  const submitAnswer = (team: TeamKey) => {
    if (phase !== 'playing' || submissions[team] !== null || !answers[team].trim()) return;
    const nextSubmissions = { ...submissions, [team]: answers[team].trim() };
    setSubmissions(nextSubmissions);
    if (nextSubmissions.blue !== null && nextSubmissions.red !== null) resolveRound(nextSubmissions);
  };

  const advance = () => {
    if (phase !== 'reveal') return;
    if (round >= questionCount) {
      setFinalSnapshot(scores);
      setPhase('finished');
      return;
    }
    setRound((current) => current + 1);
    setAnswers({ blue: '', red: '' });
    setSubmissions({ blue: null, red: null });
    setResultMessages({ blue: '', red: '' });
    setRoundEvents([]);
    setQuestion(generateQuestion(difficulty));
    setSeconds(secondsPerQuestion);
    resolvedRef.current = false;
    setPhase('playing');
  };

  const restart = () => {
    setPhase('setup');
    setScores({ blue: 0, red: 0 });
    setRound(1);
    setSeconds(secondsPerQuestion);
    setAnswers({ blue: '', red: '' });
    setSubmissions({ blue: null, red: null });
    setResultMessages({ blue: '', red: '' });
    setRoundEvents([]);
    resolvedRef.current = false;
  };

  const copyCalculatorResult = (team: TeamKey) => {
    if (calculatorResults[team]) setAnswers((current) => ({ ...current, [team]: calculatorResults[team] }));
  };

  const winner = finalSnapshot.blue === finalSnapshot.red ? 'Égalité parfaite' : finalSnapshot.blue > finalSnapshot.red ? 'Équipe Bleue remporte le duel' : 'Équipe Rouge remporte le duel';
  const timerPercent = Math.max(0, (seconds / secondsPerQuestion) * 100);
  const timerUrgent = seconds <= Math.min(10, Math.ceil(secondsPerQuestion / 3));
  const completedQuestions = phase === 'reveal' ? round : Math.max(0, round - 1);
  const commitQuestionCount = () => setQuestionCountInput(String(normalizeSetting(questionCountInput, 1, 99, 99)));
  const commitSecondsPerQuestion = () => setSecondsPerQuestionInput(String(normalizeSetting(secondsPerQuestionInput, 1, 300, 30)));

  return (
    <main className="game-shell">
      <div className="game-content">
        <header className="site-header">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true"><Swords size={20} strokeWidth={2.4} /></div>
            <div>
              <p className="brand-eyebrow">LE GRAND FACE-À-FACE DE LA CLASSE</p>
              <div className="brand-name">DUEL <span>MATHÉMATIQUE</span></div>
            </div>
          </div>
          <div className="header-right">
            <span className="classroom-tag"><span className="live-dot" /> MODE CLASSE</span>
            {phase !== 'setup' && <button className="header-reset" type="button" onClick={restart} data-testid="button-restart">
              <RotateCcw size={14} /> Recommencer
            </button>}
          </div>
        </header>

        {phase === 'setup' ? (
          <section className="setup-screen" aria-labelledby="setup-title">
            <div className="setup-intro">
              <div className="setup-copy">
                <div className="eyebrow-chip"><Sparkles size={14} /> PRÊTS À FAIRE CHAUFFER LES MÉNINGES ?</div>
                <h1 id="setup-title" className="hero-title">Deux équipes.<br /><span>Un seul calcul.</span></h1>
                <p className="hero-description">Même expression, même chrono. La classe tranche au tableau : chaque bonne réponse marque, chaque erreur fait basculer le point.</p>
              </div>
              <div className="duel-art" aria-hidden="true">
                <div className="art-score art-score-blue">BLEU<br /><b>01</b></div>
                <div className="art-cross">×</div>
                <div className="art-board">
                  <span className="board-label">DÉFI DU JOUR</span>
                  <span className="board-equation">3 + (8 × 2)</span>
                  <span className="board-line" />
                  <span className="board-hint">PRIORITÉ AUX PARENTHÈSES</span>
                </div>
                <div className="art-score art-score-red">ROUGE<br /><b>02</b></div>
                <div className="art-sticker">À VOUS<br />DE JOUER</div>
              </div>
            </div>
            <div className="setup-divider"><span>CHOISISSEZ VOTRE NIVEAU</span></div>
            <div className="difficulty-grid" role="group" aria-label="Choisir la difficulté">
              {DIFFICULTIES.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  data-testid={`button-difficulty-${item.name.toLowerCase()}`}
                  onClick={() => setDifficulty(item.name)}
                  className={`difficulty-card ${difficulty === item.name ? 'selected' : ''}`}
                  aria-pressed={difficulty === item.name}
                >
                  <span className="difficulty-number">{item.mark}</span>
                  <span className="difficulty-title">{item.name}</span>
                  <span className="difficulty-detail">{item.detail}</span>
                  <span className="difficulty-range">{item.range}</span>
                  <span className="difficulty-check"><Check size={14} /></span>
                </button>
              ))}
            </div>
            <div className="setup-bottom">
              <div className="game-settings" aria-label="Paramètres de la partie">
                <label className="setting-field" htmlFor="question-count">
                  <span className="setting-icon"><Zap size={16} /></span>
                  <span className="setting-copy"><b>Nombre de questions</b><small>De 1 à 99 par duel</small></span>
                  <input
                    id="question-count"
                    type="number"
                    min={1}
                    max={99}
                    step={1}
                    inputMode="numeric"
                    value={questionCountInput}
                    onChange={(event) => setQuestionCountInput(event.target.value)}
                    onBlur={commitQuestionCount}
                    aria-label="Nombre de questions"
                  />
                </label>
                <label className="setting-field" htmlFor="seconds-per-question">
                  <span className="setting-icon setting-icon-yellow"><Clock3 size={16} /></span>
                  <span className="setting-copy"><b>Temps par question</b><small>De 1 à 300 secondes</small></span>
                  <input
                    id="seconds-per-question"
                    type="number"
                    min={1}
                    max={300}
                    step={1}
                    inputMode="numeric"
                    value={secondsPerQuestionInput}
                    onChange={(event) => setSecondsPerQuestionInput(event.target.value)}
                    onBlur={commitSecondsPerQuestion}
                    aria-label="Secondes par question"
                  />
                </label>
              </div>
              <button type="button" className="start-button" onClick={beginGame} data-testid="button-start-game">
                LANCER LE DUEL <ArrowRight size={18} />
              </button>
            </div>
            <div className="setup-footnote">LES DEUX ÉQUIPES RÉPONDENT EN MÊME TEMPS. PAS DE HASARD, QUE DU CALCUL.</div>
          </section>
        ) : phase === 'finished' ? (
          <section className="final-screen resolution-enter" data-testid="screen-final" aria-labelledby="final-title">
            <div className="final-confetti" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
            <div className="final-trophy"><Trophy size={32} /></div>
            <p className="final-eyebrow">FIN DU DUEL · {questionCount} {questionCount === 1 ? 'QUESTION JOUÉE' : 'QUESTIONS JOUÉES'}</p>
            <h1 id="final-title">{winner}</h1>
            <p className="final-subtitle">Quel que soit le score, la classe a bien calculé.</p>
            <div className="final-scores">
              <div className="final-score-box blue-final"><span>ÉQUIPE BLEUE</span><b className="mono">{finalSnapshot.blue}</b><small>POINTS</small></div>
              <div className="final-vs">VS</div>
              <div className="final-score-box red-final"><span>ÉQUIPE ROUGE</span><b className="mono">{finalSnapshot.red}</b><small>POINTS</small></div>
            </div>
            <button type="button" className="start-button final-restart" onClick={restart} data-testid="button-play-again">
              <RotateCcw size={16} /> REJOUER UNE PARTIE
            </button>
          </section>
        ) : (
          <>
            <div className="round-bar" aria-label={`Question ${round} sur ${questionCount}`}>
              <div className="round-label"><span className="round-kicker">QUESTION</span><strong className="mono" data-testid="text-round">{String(round).padStart(2, '0')}<i> / {questionCount}</i></strong></div>
              <div className="round-progress" role="progressbar" aria-label="Progression du duel" aria-valuemin={0} aria-valuemax={questionCount} aria-valuenow={completedQuestions}>
                <div className="round-progress-fill" style={{ width: `${(completedQuestions / questionCount) * 100}%` }} />
                <div className="progress-ticks" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <i key={index} />)}</div>
              </div>
              <span className="difficulty-pill">{difficulty.toUpperCase()}</span>
            </div>

            <div className={`play-layout ${phase === 'reveal' ? 'is-revealing' : ''}`}>
              <TeamPanel
                team="blue"
                score={scores.blue}
                answer={answers.blue}
                submitted={submissions.blue !== null}
                locked={phase !== 'playing'}
                animation={scoreAnimations.blue}
                calcValue={calculatorValues.blue}
                setCalcValue={(value) => setCalculatorValues((current) => ({ ...current, blue: value }))}
                calcResult={calculatorResults.blue}
                setCalcResult={(value) => setCalculatorResults((current) => ({ ...current, blue: value }))}
                onAnswer={(value) => setAnswers((current) => ({ ...current, blue: value }))}
                onSubmit={() => submitAnswer('blue')}
                onCopy={() => copyCalculatorResult('blue')}
                message={resultMessages.blue}
              />

              <section className="challenge-column" aria-label="Question commune">
                <div className="timer-card">
                  <div className={`timer-number mono ${timerUrgent && phase === 'playing' ? 'timer-pulse' : ''}`} data-testid="text-timer" aria-live="off">
                    {phase === 'reveal' ? '00' : String(seconds).padStart(2, '0')}<span>s</span>
                  </div>
                  <div className="timer-copy">
                    <b>{phase === 'reveal' ? 'MANCHE RÉSOLUE' : timerUrgent ? 'DERNIÈRES SECONDES !' : 'LE CHRONO TOURNE'}</b>
                    <span>{phase === 'reveal' ? 'La réponse est révélée' : 'Une seule réponse par équipe'}</span>
                  </div>
                  <div className="timer-track"><span className={timerUrgent ? 'urgent' : ''} style={{ width: `${phase === 'reveal' ? 0 : timerPercent}%` }} /></div>
                </div>
                <div className="challenge-card question-enter" key={`challenge-${round}-${phase}`}>
                  <div className="challenge-top">
                    <span className="challenge-tag"><span className="challenge-tag-dot" /> DÉFI COMMUN</span>
                    <span className="challenge-sequence mono">{String(round).padStart(2, '0')} — {questionCount}</span>
                  </div>
                  <div className="challenge-prompt">{phase === 'reveal' ? 'ALORS, COMBIEN ?' : 'CALCULEZ SANS VOUS TROMPER'}</div>
                  <div className="expression-wrap">
                    <span className="expression-bracket" aria-hidden="true">[</span>
                    <div className="expression mono" data-testid="text-expression">{question.expression}</div>
                    <span className="expression-bracket" aria-hidden="true">]</span>
                  </div>
                  {phase === 'reveal' ? (
                    <div className="answer-reveal resolution-enter" data-testid="text-correct-answer">
                      <span>LA BONNE RÉPONSE</span><strong className="mono">{question.answer}</strong>
                    </div>
                  ) : (
                    <div className="priority-note"><span>!</span> On respecte l’ordre des opérations</div>
                  )}
                  <div className="challenge-rule" />
                  {phase === 'reveal' ? (
                    <div className="round-resolution resolution-enter" aria-live="polite" data-testid="status-round-result">
                      <p className="resolution-heading"><Zap size={15} /> LE VERDICT DU TABLEAU</p>
                      {roundEvents.map((event, index) => <p className="resolution-line" key={`${round}-${index}`}>{event}</p>)}
                      <button type="button" className="next-button" onClick={advance} data-testid="button-next-question">
                        {round >= questionCount ? 'VOIR LE RÉSULTAT FINAL' : 'QUESTION SUIVANTE'} <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="challenge-footer">
                      <span><Swords size={14} /> MÊME QUESTION, MÊME CHANCE</span>
                      <span className="seal">DM<span>·</span>01</span>
                    </div>
                  )}
                </div>
                <div className="fair-play-note"><span className="fair-play-icon"><Check size={14} /></span><span><b>RÈGLE DU DUEL</b> Une erreur ? Le point va à l’autre équipe. Aucun score sous zéro.</span></div>
              </section>

              <TeamPanel
                team="red"
                score={scores.red}
                answer={answers.red}
                submitted={submissions.red !== null}
                locked={phase !== 'playing'}
                animation={scoreAnimations.red}
                calcValue={calculatorValues.red}
                setCalcValue={(value) => setCalculatorValues((current) => ({ ...current, red: value }))}
                calcResult={calculatorResults.red}
                setCalcResult={(value) => setCalculatorResults((current) => ({ ...current, red: value }))}
                onAnswer={(value) => setAnswers((current) => ({ ...current, red: value }))}
                onSubmit={() => submitAnswer('red')}
                onCopy={() => copyCalculatorResult('red')}
                message={resultMessages.red}
              />
            </div>
            <footer className="game-footer">
              <span>DUEL MATHÉMATIQUE <i>·</i> LE CALCUL, C’EST COLLECTIF.</span>
              <button type="button" onClick={restart} data-testid="button-reset-round"><ArrowLeft size={13} /> RETOUR AU CHOIX DU NIVEAU</button>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}

export default App;