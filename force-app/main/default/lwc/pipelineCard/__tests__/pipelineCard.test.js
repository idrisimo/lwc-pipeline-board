import { createElement } from 'lwc';
import PipelineCard from 'c/pipelineCard';

const RECORD = {
    Id: '006000000000001',
    Name: 'Acme Renewal',
    Amount: 12000,
    CloseDate: '2099-01-15',
    StageName: 'Prospecting',
    IsClosed: false,
    Account: { Name: 'Acme Corp' },
    Owner: { Name: 'Jane Doe' }
};

const flushPromises = () => Promise.resolve();

function build(record = RECORD) {
    const element = createElement('c-pipeline-card', { is: PipelineCard });
    element.record = record;
    document.body.appendChild(element);
    return element;
}

describe('c-pipeline-card', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders name, account and owner', () => {
        const element = build();
        expect(element.shadowRoot.querySelector('.card-name').textContent).toBe('Acme Renewal');
        expect(element.shadowRoot.querySelector('.account-name').textContent).toBe('Acme Corp');
        expect(element.shadowRoot.querySelector('.owner-name').textContent).toBe('Jane Doe');
        expect(element.shadowRoot.querySelector('.amount lightning-formatted-number').value).toBe(
            12000
        );
    });

    it('falls back when account and amount are missing', () => {
        const element = build({ ...RECORD, Account: null, Amount: null, Owner: null });
        expect(element.shadowRoot.querySelector('.account-name').textContent).toBe('No account');
        expect(element.shadowRoot.querySelector('.amount lightning-formatted-number')).toBeNull();
    });

    it('flags overdue open opportunities', () => {
        const element = build({ ...RECORD, CloseDate: '2000-01-01' });
        expect(element.shadowRoot.querySelector('.close-date').className).toContain(
            'slds-text-color_error'
        );
    });

    it('does not flag closed opportunities as overdue', () => {
        const element = build({ ...RECORD, CloseDate: '2000-01-01', IsClosed: true });
        expect(element.shadowRoot.querySelector('.close-date').className).not.toContain(
            'slds-text-color_error'
        );
    });

    it('dispatches select on click and on Enter', () => {
        const element = build();
        const handler = jest.fn();
        element.addEventListener('select', handler);
        const card = element.shadowRoot.querySelector('.card');

        card.click();
        card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        card.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler.mock.calls[0][0].detail).toEqual({ recordId: RECORD.Id });
    });

    it('sets the record id on the drag payload and toggles the dragging class', async () => {
        const element = build();
        await flushPromises();
        const card = element.shadowRoot.querySelector('.card');
        const dragEvent = new CustomEvent('dragstart', { bubbles: true });
        dragEvent.dataTransfer = { setData: jest.fn(), effectAllowed: '' };

        card.dispatchEvent(dragEvent);
        expect(dragEvent.dataTransfer.setData).toHaveBeenCalledWith('text/plain', RECORD.Id);
        expect(card.classList.contains('card_dragging')).toBe(true);

        card.dispatchEvent(new CustomEvent('dragend'));
        expect(card.classList.contains('card_dragging')).toBe(false);
    });
});
