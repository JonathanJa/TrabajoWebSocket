import type { VariantId } from '../engine/variants';

export type AcademyId = VariantId | 'chinese';

export interface LessonStep {
    title: string;
    body: string;
}

export interface Tutorial {
    id: AcademyId;
    name: string;
    eyebrow: string;
    introduction: string;
    steps: readonly LessonStep[];
    prompts: readonly string[];
}

export const TUTORIALS: Record<AcademyId, Tutorial> = {
    spanish: {
        id: 'spanish',
        name: 'Damas españolas',
        eyebrow: '8 × 8 · 12 fichas por lado',
        introduction:
            'La versión clásica de España se juega en las casillas claras. Gana quien captura o bloquea todas las piezas rivales.',
        steps: [
            {
                title: 'Prepara el tablero',
                body: 'Coloca doce peones en las tres filas más cercanas a cada jugador. Empieza el bando claro. Solo se ocupan las casillas claras.',
            },
            {
                title: 'Mueve y captura',
                body: 'Los peones avanzan una casilla en diagonal y solo capturan hacia delante. Capturar es obligatorio y debes escoger la secuencia que coma más piezas.',
            },
            {
                title: 'Corona y gana',
                body: 'Al llegar a la última fila, el peón se convierte en dama. La dama vuela por diagonales; si empatas en cantidad, debes capturar primero las damas rivales. La cadena termina antes de coronar.',
            },
        ],
        prompts: [
            '¿Cómo se captura?',
            '¿Cómo se mueve la dama?',
            '¿Qué pasa al coronar?',
        ],
    },
    international: {
        id: 'international',
        name: 'Damas internacionales',
        eyebrow: '10 × 10 · 20 fichas por lado',
        introduction:
            'La modalidad internacional amplía el tablero y exige escoger siempre la captura que retire más piezas.',
        steps: [
            {
                title: 'Prepara el tablero',
                body: 'Cada bando ocupa las cuatro filas más cercanas con veinte fichas en casillas oscuras. Quedan vacías las dos filas centrales.',
            },
            {
                title: 'Mueve y captura',
                body: 'Los peones avanzan una casilla en diagonal, pero capturan hacia delante y hacia atrás. La captura es obligatoria; entre cadenas posibles se elige la de mayor cantidad.',
            },
            {
                title: 'Corona y gana',
                body: 'La dama vuela por diagonales y puede aterrizar en cualquier casilla libre detrás de la pieza capturada. Los peones capturados se retiran al terminar la secuencia. Gana quien deja al rival sin piezas o sin movimientos.',
            },
        ],
        prompts: [
            '¿Puedo capturar hacia atrás?',
            '¿Qué significa captura máxima?',
            '¿Cómo se mueve una dama?',
        ],
    },
    turkish: {
        id: 'turkish',
        name: 'Damas turcas',
        eyebrow: '8 × 8 · 16 fichas por lado',
        introduction:
            'Dama se juega en todas las casillas: los peones avanzan en líneas rectas y las damas se desplazan como torres.',
        steps: [
            {
                title: 'Prepara el tablero',
                body: 'Coloca dieciséis piezas en las dos filas interiores de cada lado; la fila del borde queda vacía. Se juega sobre las 64 casillas.',
            },
            {
                title: 'Mueve y captura',
                body: 'Un peón avanza o se desplaza a izquierda o derecha una casilla, nunca hacia atrás ni en diagonal. Captura saltando en esas mismas direcciones; la captura máxima es obligatoria.',
            },
            {
                title: 'Corona y gana',
                body: 'Al alcanzar la última fila, el peón se corona. La dama se mueve y captura en líneas ortogonales, pudiendo recorrer varias casillas. Las piezas capturadas se retiran mientras continúa la cadena.',
            },
        ],
        prompts: [
            '¿Se puede mover de lado?',
            '¿Cómo captura la dama turca?',
            '¿Se juega en casillas oscuras?',
        ],
    },
    chinese: {
        id: 'chinese',
        name: 'Damas chinas',
        eyebrow: 'Juego de saltos · 2 a 6 jugadores',
        introduction:
            'Aunque se llaman damas, no pertenecen a la familia de las damas: se juega en una estrella con canicas y no se captura ninguna pieza.',
        steps: [
            {
                title: 'Prepara la estrella',
                body: 'Cada jugador elige un color y coloca sus canicas en uno de los triángulos exteriores. Con más jugadores se ocupan más puntas de la estrella.',
            },
            {
                title: 'Avanza o salta',
                body: 'En tu turno, mueve una canica a un hueco vecino o salta sobre una canica adyacente a un hueco vacío. Puedes encadenar varios saltos en el mismo turno.',
            },
            {
                title: 'Llega al triángulo opuesto',
                body: 'Las canicas saltadas permanecen en el tablero: no se comen ni se retiran. Gana quien lleva primero todas sus canicas al triángulo opuesto.',
            },
        ],
        prompts: [
            '¿Se comen las canicas?',
            '¿Puedo encadenar saltos?',
            '¿Cómo se gana?',
        ],
    },
};

const normalize = (text: string): string =>
    text
        .toLocaleLowerCase('es')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

export const assistantReply = (
    question: string,
    tutorialId: AcademyId,
    previousTopic = '',
): { topic: string; text: string } => {
    const tutorial = TUTORIALS[tutorialId];
    const normalized = normalize(question);
    const combined = `${normalized} ${normalize(previousTopic)}`;
    const chinese = tutorialId === 'chinese';

    if (
        /^(hola|buenas|hey|buen dia|buenas tardes|buenas noches)\b/.test(
            normalized,
        )
    ) {
        return {
            topic: 'saludo',
            text: `¡Hola! Estoy aquí para ayudarte con ${tutorial.name}. ¿Quieres ver los movimientos, las capturas o cómo se gana?`,
        };
    }

    if (/gracias|genial|perfecto/.test(normalized)) {
        return {
            topic: 'agradecimiento',
            text: '¡De nada! Podemos practicar otra regla cuando quieras.',
        };
    }

    if (
        previousTopic !== '' &&
        /^(y|entonces|eso|esa|ese|puedes explicar|explica mas|no entendi)\b/.test(
            normalized,
        )
    ) {
        const stepByTopic: Record<string, number> = {
            preparación: 0,
            movimiento: 1,
            captura: 1,
            coronación: 2,
            objetivo: 2,
        };
        const followUpStep = stepByTopic[previousTopic];

        if (followUpStep !== undefined) {
            return {
                topic: previousTopic,
                text: tutorial.steps[followUpStep].body,
            };
        }
    }

    if (chinese && /mov|avanz|turno|saltar|salto/.test(normalized)) {
        return { topic: 'movimiento', text: tutorial.steps[1].body };
    }

    if (chinese && /captur|comer|comen|eliminar|retirar/.test(combined)) {
        return {
            topic: 'captura',
            text: 'En damas chinas no se capturan piezas. Saltas sobre una canica para llegar a un hueco libre, y esa canica permanece donde estaba.',
        };
    }

    if (/captur|comer|comen|salto/.test(normalized)) {
        return { topic: 'captura', text: tutorial.steps[1].body };
    }

    if (/dama|reina|coron|promocion/.test(normalized)) {
        return { topic: 'coronación', text: tutorial.steps[2].body };
    }

    if (/mov|avanz|turno|ficha|peon/.test(normalized)) {
        return { topic: 'movimiento', text: tutorial.steps[1].body };
    }

    if (/gan|objetivo|final|vencer|victoria/.test(normalized)) {
        return { topic: 'objetivo', text: tutorial.steps[2].body };
    }

    if (
        /tablero|prepar|inicio|empez|cuantas|cuantos|fichas|jugadores/.test(
            normalized,
        )
    ) {
        return { topic: 'preparación', text: tutorial.steps[0].body };
    }

    return {
        topic: 'orientación',
        text: `Te cuento sobre ${tutorial.name}. ${tutorial.introduction} Pregúntame por el tablero, los movimientos, las capturas o el objetivo.`,
    };
};
