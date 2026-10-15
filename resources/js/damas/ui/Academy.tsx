import {
    BookOpen,
    ChevronLeft,
    ChevronRight,
    MessageCircle,
    Send,
    Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { assistantReply, TUTORIALS, type AcademyId } from '../game/academy';
import { Button, IconButton, Plate, SegNav } from './primitives';

interface ChatMessage {
    id: number;
    role: 'assistant' | 'player';
    topic: string;
    text: string;
}

interface AcademyProps {
    tutorialId: AcademyId;
    onTutorialChange: (tutorialId: AcademyId) => void;
    onSpeak: (text: string) => void;
}

const messageId = (): number => Date.now() + Math.random();

export const Academy = ({
    tutorialId,
    onTutorialChange,
    onSpeak,
}: AcademyProps) => {
    const tutorial = TUTORIALS[tutorialId];
    const [stepIndex, setStepIndex] = useState(0);
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 1,
            role: 'assistant',
            topic: 'saludo',
            text: `¡Hola! Soy tu asistente. Podemos aprender ${tutorial.name} paso a paso. ¿Qué te gustaría aclarar?`,
        },
    ]);
    const previousTopic = useRef('');
    const previousTutorial = useRef(tutorialId);
    const conversationEnd = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (previousTutorial.current === tutorialId) {
            return;
        }

        previousTutorial.current = tutorialId;
        setStepIndex(0);
        const greeting = `Cambiamos a ${tutorial.name}. ${tutorial.introduction} ¿Qué parte quieres revisar?`;
        setMessages((current) =>
            [
                ...current,
                {
                    id: messageId(),
                    role: 'assistant' as const,
                    topic: 'reglamento',
                    text: greeting,
                },
            ].slice(-30),
        );
    }, [tutorialId, tutorial]);

    useEffect(() => {
        conversationEnd.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const ask = (text: string) => {
        const trimmed = text.trim();
        if (trimmed === '') {
            return;
        }

        const answer = assistantReply(
            trimmed,
            tutorialId,
            previousTopic.current,
        );
        previousTopic.current = answer.topic;
        setMessages((current) =>
            [
                ...current,
                {
                    id: messageId(),
                    role: 'player' as const,
                    topic: 'pregunta',
                    text: trimmed,
                },
                {
                    id: messageId(),
                    role: 'assistant' as const,
                    topic: answer.topic,
                    text: answer.text,
                },
            ].slice(-30),
        );
        setQuestion('');
    };

    const submitQuestion = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        ask(question);
    };

    const step = tutorial.steps[stepIndex];

    return (
        <div className="d-stack">
            <Plate label="ELIGE UN JUEGO">
                <SegNav<AcademyId>
                    value={tutorialId}
                    options={[
                        { value: 'spanish', label: 'ESPAÑOL' },
                        { value: 'international', label: 'INTERNACIONAL' },
                        { value: 'turkish', label: 'TURCAS' },
                        { value: 'chinese', label: 'CHINAS' },
                    ]}
                    onChange={onTutorialChange}
                    label="Tutorial de juego"
                />
            </Plate>

            <div className="d-grid d-grid--split d-academy-grid">
                <section className="d-stack">
                    <Plate label={`${tutorial.eyebrow} · TUTORIAL`} accent>
                        <div className="d-stack" style={{ gap: 12 }}>
                            <div className="d-row d-row--between">
                                <span className="d-glyph d-acc">
                                    <BookOpen size={18} />
                                    <span className="d-mono">
                                        LECCIÓN {stepIndex + 1} /{' '}
                                        {tutorial.steps.length}
                                    </span>
                                </span>
                                <div className="d-row">
                                    <IconButton
                                        icon={ChevronLeft}
                                        label="Lección anterior"
                                        disabled={stepIndex === 0}
                                        onClick={() =>
                                            setStepIndex((index) =>
                                                Math.max(0, index - 1),
                                            )
                                        }
                                    />
                                    <IconButton
                                        icon={ChevronRight}
                                        label="Lección siguiente"
                                        disabled={
                                            stepIndex ===
                                            tutorial.steps.length - 1
                                        }
                                        onClick={() =>
                                            setStepIndex((index) =>
                                                Math.min(
                                                    tutorial.steps.length - 1,
                                                    index + 1,
                                                ),
                                            )
                                        }
                                    />
                                </div>
                            </div>
                            <div
                                className="d-bar"
                                aria-label={`Lección ${stepIndex + 1} de ${tutorial.steps.length}`}
                            >
                                <div
                                    className="d-bar__fill d-bar__fill--set"
                                    style={{
                                        transform: `scaleX(${(stepIndex + 1) / tutorial.steps.length})`,
                                    }}
                                />
                            </div>
                            <h2
                                className="d-display"
                                style={{ margin: 0, fontSize: 20 }}
                            >
                                {step.title}
                            </h2>
                            <p className="d-lead" style={{ margin: 0 }}>
                                {step.body}
                            </p>
                            {tutorialId === 'chinese' ? (
                                <p
                                    className="d-mono d-acc"
                                    style={{ margin: 0 }}
                                >
                                    JUEGO DE SALTOS · NO SE CAPTURAN PIEZAS
                                </p>
                            ) : null}
                        </div>
                    </Plate>
                    <div className="d-row d-row--between">
                        <Button
                            icon={ChevronLeft}
                            disabled={stepIndex === 0}
                            onClick={() =>
                                setStepIndex((index) => Math.max(0, index - 1))
                            }
                        >
                            Anterior
                        </Button>
                        <Button
                            icon={ChevronRight}
                            variant="accent"
                            disabled={stepIndex === tutorial.steps.length - 1}
                            onClick={() =>
                                setStepIndex((index) =>
                                    Math.min(
                                        tutorial.steps.length - 1,
                                        index + 1,
                                    ),
                                )
                            }
                        >
                            Siguiente
                        </Button>
                    </div>
                </section>

                <section className="d-stack">
                    <Plate label="ASISTENTE DE DAMAS" accent>
                        <div className="d-stack" style={{ gap: 12 }}>
                            <div className="d-row d-row--between">
                                <span className="d-glyph d-acc">
                                    <MessageCircle size={18} />
                                    <span className="d-mono">CONVERSACIÓN</span>
                                </span>
                                <span className="d-chip">{tutorial.name}</span>
                            </div>
                            <div
                                className="d-chat-log"
                                role="log"
                                aria-live="polite"
                                aria-label="Conversación con el asistente"
                            >
                                {messages.map((message) => (
                                    <article
                                        key={message.id}
                                        className={`d-chat-message d-chat-message--${message.role}`}
                                    >
                                        <div className="d-row d-row--between">
                                            <span className="d-mono d-mute">
                                                {message.role === 'assistant'
                                                    ? 'ASISTENTE'
                                                    : 'TÚ'}
                                            </span>
                                            {message.role === 'assistant' ? (
                                                <IconButton
                                                    icon={Volume2}
                                                    label="Escuchar respuesta"
                                                    onClick={() =>
                                                        onSpeak(message.text)
                                                    }
                                                />
                                            ) : null}
                                        </div>
                                        <p style={{ margin: '6px 0 0' }}>
                                            {message.text}
                                        </p>
                                    </article>
                                ))}
                                <div ref={conversationEnd} />
                            </div>
                            <div className="d-row">
                                {tutorial.prompts.map((prompt) => (
                                    <button
                                        key={prompt}
                                        type="button"
                                        className="d-chat-prompt"
                                        onClick={() => ask(prompt)}
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                            <form
                                className="d-row d-chat-form"
                                onSubmit={submitQuestion}
                            >
                                <label
                                    className="sr-only"
                                    htmlFor="assistant-question"
                                >
                                    Pregunta al asistente
                                </label>
                                <input
                                    id="assistant-question"
                                    className="d-input"
                                    value={question}
                                    maxLength={240}
                                    placeholder="Escribe tu pregunta..."
                                    onChange={(event) =>
                                        setQuestion(event.target.value)
                                    }
                                />
                                <Button
                                    icon={Send}
                                    variant="accent"
                                    disabled={question.trim() === ''}
                                    ariaLabel="Enviar pregunta"
                                    onClick={() => ask(question)}
                                />
                            </form>
                        </div>
                    </Plate>
                </section>
            </div>
        </div>
    );
};
