import { createElement } from 'lwc';
import PipelineColumn from 'c/pipelineColumn';

const CARDS = [
    { Id: '006000000000001', Name: 'Opp A', Amount: 1000, StageName: 'Prospecting' },
    { Id: '006000000000002', Name: 'Opp B', Amount: 2500, StageName: 'Prospecting' },
    { Id: '006000000000003', Name: 'Opp C', StageName: 'Prospecting' }
];

function build(props = {}) {
    const element = createElement('c-pipeline-column', { is: PipelineColumn });
    Object.assign(element, { stage: 'Prospecting', cards: CARDS, ...props });
    document.body.appendChild(element);
    return element;
}

function dropEvent(recordId) {
    const event = new CustomEvent('drop', { bubbles: true, cancelable: true });
    event.dataTransfer = { getData: jest.fn().mockReturnValue(recordId) };
    return event;
}

describe('c-pipeline-column', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders header with stage, count and total amount', () => {
        const element = build();
        const root = element.shadowRoot;
        expect(root.querySelector('h2').textContent).toBe('Prospecting');
        expect(root.querySelector('.count').textContent).toBe('3');
        expect(root.querySelector('lightning-formatted-number.total').value).toBe(3500);
    });

    it('renders one card per opportunity', () => {
        const element = build();
        expect(element.shadowRoot.querySelectorAll('c-pipeline-card')).toHaveLength(3);
    });

    it('limits visible cards to maxCards and shows a note', () => {
        const element = build({ maxCards: 2 });
        expect(element.shadowRoot.querySelectorAll('c-pipeline-card')).toHaveLength(2);
        expect(element.shadowRoot.querySelector('.hidden-note').textContent).toContain('+1 more');
        // count and total still reflect all cards
        expect(element.shadowRoot.querySelector('.count').textContent).toBe('3');
    });

    it('shows an empty state and tolerates non-array cards', () => {
        const element = build({ cards: null });
        expect(element.shadowRoot.querySelector('.empty')).not.toBeNull();
        expect(element.shadowRoot.querySelector('.count').textContent).toBe('0');
    });

    it('dispatches cardmove with record id and stage on drop', () => {
        const element = build();
        const handler = jest.fn();
        element.addEventListener('cardmove', handler);

        element.shadowRoot.querySelector('section').dispatchEvent(dropEvent('006000000000009'));

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail).toEqual({
            recordId: '006000000000009',
            stage: 'Prospecting'
        });
    });

    it('ignores drops without a record id', () => {
        const element = build();
        const handler = jest.fn();
        element.addEventListener('cardmove', handler);

        element.shadowRoot.querySelector('section').dispatchEvent(dropEvent(''));

        expect(handler).not.toHaveBeenCalled();
    });

    it('highlights on dragover and clears on dragleave', async () => {
        const element = build();
        const section = element.shadowRoot.querySelector('section');

        const over = new CustomEvent('dragover', { cancelable: true });
        over.dataTransfer = { dropEffect: '' };
        section.dispatchEvent(over);
        await Promise.resolve();
        expect(over.defaultPrevented).toBe(true);
        expect(section.classList.contains('column_over')).toBe(true);

        section.dispatchEvent(new CustomEvent('dragleave'));
        await Promise.resolve();
        expect(section.classList.contains('column_over')).toBe(false);
    });

    it('re-dispatches card selection as cardselect', () => {
        const element = build();
        const handler = jest.fn();
        element.addEventListener('cardselect', handler);

        const card = element.shadowRoot.querySelector('c-pipeline-card');
        card.dispatchEvent(new CustomEvent('select', { detail: { recordId: CARDS[0].Id } }));

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail).toEqual({ recordId: CARDS[0].Id });
    });
});
