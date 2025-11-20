import Dexie, { type Table } from 'dexie';
import type { Invoice, Supplier, KnowledgeBaseRule, GlobalContextItem, Product } from './types';

export class MinimarketDatabase extends Dexie {
    invoices!: Table<Invoice>;
    suppliers!: Table<Supplier>;
    rules!: Table<KnowledgeBaseRule>;
    globalContext!: Table<GlobalContextItem>;
    products!: Table<Product>;

    constructor() {
        super('Jardines3MinimarketDB');
        this.version(1).stores({
            invoices: '++id, providerName, issueDate, ncf, status, [issueDate+providerName]',
            suppliers: '++id, name, rnc',
            rules: '++id, supplierId'
        });

        // Version 2 adds globalContext
        this.version(2).stores({
            globalContext: '++id, title, type, category'
        });

        // Version 3 adds category to existing items if needed (handled by code logic)
        this.version(3).stores({
            globalContext: '++id, title, type, category'
        });

        // Version 4 adds products
        this.version(4).stores({
            products: '++id, supplierId, name, [supplierId+name]'
        });
    }
}

export const db = new MinimarketDatabase();
