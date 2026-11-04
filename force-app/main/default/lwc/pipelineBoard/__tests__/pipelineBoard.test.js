import { createElement } from 'lwc';
import PipelineBoard from 'c/pipelineBoard';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import { updateRecord } from 'lightning/uiRecordApi';
import { refreshApex } from '@salesforce/apex';
import getOpportunities from '@salesforce/apex/PipelineBoardController.getOpportunities';

jest.mock(
    '@salesforce/apex/PipelineBoardController.getOpportunities',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex',
    () => ({
        refreshApex: jest.fn(() => Promise.resolve())
    }),
    { virtual: true }
);

jest.mock(
    'lightning/navigation',
    () => {
        const Navigate = Symbol('Navigate');
        const NavigationMixin = (Base) =>
            class extends Base {
                [Navigate](pageReference) {
                    global.navigateMock(pageReference);
                }
            };
        NavigationMixin.Navigate = Navigate;
        return { NavigationMixin };
    },
    { virtual: true }
);

const OBJECT_INFO = { defaultRecordTypeId: '012000000000000AAA' };
const PICKLIST = {
    values: [
        { label: 'Prospecting', value: 'Prospecting' },
        { label: 'Qualification', value: 'Qualification' },
        { label: 'Closed Won', value: 'Closed Won' }
    ]
};
const OPPS = [
    { Id: '006000000000001', Name: 'A', Amount: 1000, StageName: 'Prospecting' },
    { Id: '006000000000002', Name: 'B', Amount: 2000, StageName: 'Prospecting' },
    { Id: '006000000000003', Name: 'C', Amount: 500, StageName: 'Qualification' }
];

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function build(props = {}) {
    const element = createElement('c-pipeline-board', { is: PipelineBoard });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

async function load(element, opps = OPPS) {
    getObjectInfo.emit(OBJECT_INFO);
    getPicklistValues.emit(PICKLIST);
    getOpportunities.emit(opps);
    await flushPromises();
    return element.shadowRoot.querySelectorAll('c-pipeline-column');
}

describe('c-pipeline-board', () => {
    beforeEach(() => {
        global.navigateMock = jest.fn();
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    it('renders a column per stage picklist value with counts and totals', async () => {
        const element = build();
        const columns = await load(element);

        expect(columns).toHaveLength(3);
        expect(Array.from(columns).map((c) => c.stage)).toEqual([
            'Prospecting',
            'Qualification',
            'Closed Won'
        ]);
        expect(columns[0].cards).toHaveLength(2);
        expect(columns[1].cards).toHaveLength(1);
        expect(columns[2].cards).toHaveLength(0);
        expect(columns[0].cards.reduce((s, c) => s + c.Amount, 0)).toBe(3000);
    });

    it('passes maxCardsPerColumn to columns and falls back to 50 when invalid', async () => {
        const element = build({ maxCardsPerColumn: 7 });
        let columns = await load(element);
        expect(columns[0].maxCards).toBe(7);

        element.maxCardsPerColumn = 0;
        await flushPromises();
        columns = element.shadowRoot.querySelectorAll('c-pipeline-column');
        expect(columns[0].maxCards).toBe(50);
    });

    it('shows a spinner before stages arrive', () => {
        const element = build();
        expect(element.shadowRoot.querySelector('lightning-spinner')).not.toBeNull();
    });

    it('shows an error message when opportunities fail to load', async () => {
        const element = build();
        getObjectInfo.emit(OBJECT_INFO);
        getPicklistValues.emit(PICKLIST);
        getOpportunities.error({ message: 'Boom' });
        await flushPromises();

        expect(element.shadowRoot.querySelector('.load-error').textContent).toContain('Boom');
    });

    it('toasts when stages fail to load', async () => {
        const element = build();
        const handler = jest.fn();
        element.addEventListener('lightning__showtoast', handler);
        getObjectInfo.emit(OBJECT_INFO);
        getPicklistValues.error([{ message: 'No picklist' }]);
        await flushPromises();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail.message).toBe('No picklist');
    });

    it('re-queries Apex with filters when the owner and dates change', async () => {
        const element = build();
        await load(element);

        const owner = element.shadowRoot.querySelector('.owner-filter');
        owner.dispatchEvent(new CustomEvent('change', { detail: { value: 'ALL' } }));

        const from = element.shadowRoot.querySelector('.from-filter');
        from.value = '2026-01-01';
        from.dispatchEvent(new CustomEvent('change'));

        const to = element.shadowRoot.querySelector('.to-filter');
        to.value = '2026-12-31';
        to.dispatchEvent(new CustomEvent('change'));
        await flushPromises();

        expect(getOpportunities.getLastConfig()).toEqual({
            ownerFilter: 'ALL',
            closeFrom: '2026-01-01',
            closeTo: '2026-12-31',
            searchTerm: ''
        });

        from.value = '';
        from.dispatchEvent(new CustomEvent('change'));
        await flushPromises();
        expect(getOpportunities.getLastConfig().closeFrom).toBeNull();
    });

    it('debounces the search box', async () => {
        jest.useFakeTimers();
        const element = build();
        getObjectInfo.emit(OBJECT_INFO);
        getPicklistValues.emit(PICKLIST);
        getOpportunities.emit(OPPS);

        const search = element.shadowRoot.querySelector('.search-filter');
        search.value = 'ac';
        search.dispatchEvent(new CustomEvent('change'));
        search.value = 'acme';
        search.dispatchEvent(new CustomEvent('change'));

        jest.advanceTimersByTime(200);
        expect(getOpportunities.getLastConfig().searchTerm).not.toBe('acme');

        jest.advanceTimersByTime(200);
        jest.useRealTimers();
        await flushPromises();
        expect(getOpportunities.getLastConfig().searchTerm).toBe('acme');
    });

    it('moves a card optimistically, saves the stage and refreshes', async () => {
        const element = build();
        const columns = await load(element);

        columns[1].dispatchEvent(
            new CustomEvent('cardmove', {
                detail: { recordId: OPPS[0].Id, stage: 'Qualification' }
            })
        );
        await Promise.resolve();

        // optimistic: rendered before updateRecord resolves
        const afterMove = element.shadowRoot.querySelectorAll('c-pipeline-column');
        expect(afterMove[0].cards).toHaveLength(1);
        expect(afterMove[1].cards).toHaveLength(2);

        await flushPromises();
        expect(updateRecord).toHaveBeenCalledWith({
            fields: { Id: OPPS[0].Id, StageName: 'Qualification' }
        });
        expect(refreshApex).toHaveBeenCalledTimes(1);
    });

    it('ignores a drop onto the card current stage', async () => {
        const element = build();
        const columns = await load(element);

        columns[0].dispatchEvent(
            new CustomEvent('cardmove', { detail: { recordId: OPPS[0].Id, stage: 'Prospecting' } })
        );
        await flushPromises();

        expect(updateRecord).not.toHaveBeenCalled();
    });

    it('ignores a drop for an unknown record', async () => {
        const element = build();
        const columns = await load(element);

        columns[0].dispatchEvent(
            new CustomEvent('cardmove', { detail: { recordId: 'nope', stage: 'Qualification' } })
        );
        await flushPromises();

        expect(updateRecord).not.toHaveBeenCalled();
    });

    it('rolls back and shows an error toast when the update fails', async () => {
        updateRecord.mockRejectedValueOnce({ body: { message: 'Validation failed' } });
        const element = build();
        const toast = jest.fn();
        element.addEventListener('lightning__showtoast', toast);
        const columns = await load(element);

        columns[1].dispatchEvent(
            new CustomEvent('cardmove', {
                detail: { recordId: OPPS[0].Id, stage: 'Qualification' }
            })
        );
        await flushPromises();

        const after = element.shadowRoot.querySelectorAll('c-pipeline-column');
        expect(after[0].cards).toHaveLength(2);
        expect(after[1].cards).toHaveLength(1);
        expect(refreshApex).not.toHaveBeenCalled();
        expect(toast).toHaveBeenCalledTimes(1);
        expect(toast.mock.calls[0][0].detail.variant).toBe('error');
        expect(toast.mock.calls[0][0].detail.message).toBe('Validation failed');
    });

    it('navigates to the record page when a card is selected', async () => {
        const element = build();
        const columns = await load(element);

        columns[0].dispatchEvent(
            new CustomEvent('cardselect', { detail: { recordId: OPPS[0].Id } })
        );

        expect(global.navigateMock).toHaveBeenCalledTimes(1);
        const pageReference = global.navigateMock.mock.calls[0][0];
        expect(pageReference.type).toBe('standard__recordPage');
        expect(pageReference.attributes.recordId).toBe(OPPS[0].Id);
    });
});
