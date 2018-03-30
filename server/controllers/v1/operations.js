import moment from 'moment';

import Category from '../../models/category';
import Operation from '../../models/operation';
import OperationType from '../../models/operationtype';

import { KError, asyncErr, UNKNOWN_OPERATION_TYPE } from '../../helpers';

async function preload(varName, req, res, next, operationID) {
    try {
        let operation = await Operation.find(operationID);
        if (!operation) {
            throw new KError('bank operation not found', 404);
        }
        req.preloaded = req.preloaded || {};
        req.preloaded[varName] = operation;
        return next();
    } catch (err) {
        return asyncErr(res, err, 'when preloading an operation');
    }
}

export function preloadOperation(req, res, next, operationID) {
    preload('operation', req, res, next, operationID);
}

export function preloadOtherOperation(req, res, next, otherOperationID) {
    preload('otherOperation', req, res, next, otherOperationID);
}

export async function update(req, res) {
    try {
        let attr = req.body;

        // We can only update the category id, operation type, custom label or budget date
        // of an operation.
        if (
            typeof attr.categoryId === 'undefined' &&
            typeof attr.type === 'undefined' &&
            typeof attr.customLabel === 'undefined' &&
            typeof attr.budgetDate === 'undefined'
        ) {
            throw new KError('Missing parameter', 400);
        }

        if (typeof attr.categoryId !== 'undefined') {
            if (attr.categoryId === '') {
                delete req.preloaded.operation.categoryId;
            } else {
                let newCategory = await Category.find(attr.categoryId);
                if (!newCategory) {
                    throw new KError('Category not found', 404);
                } else {
                    req.preloaded.operation.categoryId = attr.categoryId;
                }
            }
        }

        if (typeof attr.type !== 'undefined') {
            if (OperationType.isKnown(attr.type)) {
                req.preloaded.operation.type = attr.type;
            } else {
                req.preloaded.operation.type = UNKNOWN_OPERATION_TYPE;
            }
        }

        if (typeof attr.customLabel !== 'undefined') {
            if (attr.customLabel === '') {
                delete req.preloaded.operation.customLabel;
            } else {
                req.preloaded.operation.customLabel = attr.customLabel;
            }
        }

        if (typeof attr.budgetDate !== 'undefined') {
            if (attr.budgetDate === null) {
                req.preloaded.operation.budgetDate = null;
            } else {
                req.preloaded.operation.budgetDate = new Date(attr.budgetDate);
            }
        }

        await req.preloaded.operation.save();
        res.status(200).end();
    } catch (err) {
        return asyncErr(res, err, 'when updating attributes of operation');
    }
}

export async function merge(req, res) {
    try {
        // @operation is the one to keep, @otherOperation is the one to delete.
        let otherOp = req.preloaded.otherOperation;
        let op = req.preloaded.operation;

        // Transfer various fields upon deletion
        let needsSave = op.mergeWith(otherOp);

        if (needsSave) {
            op = await op.save();
        }
        await otherOp.destroy();
        res.status(200).json(op);
    } catch (err) {
        return asyncErr(res, err, 'when merging two operations');
    }
}

// Create a new operation
export async function create(req, res) {
    try {
        let operation = req.body;
        if (!Operation.isOperation(operation)) {
            throw new KError('Not an operation', 400);
        }
        // We fill the missing fields
        operation.raw = operation.title;
        operation.customLabel = operation.title;
        operation.dateImport = moment().format('YYYY-MM-DDTHH:mm:ss.000Z');
        operation.createdByUser = true;
        let op = await Operation.create(operation);
        res.status(201).json(op);
    } catch (err) {
        return asyncErr(res, err, 'when creating operation for a bank account');
    }
}

// Delete an operation
export async function destroy(req, res) {
    try {
        let op = req.preloaded.operation;
        await op.destroy();
        res.status(204).end();
    } catch (err) {
        return asyncErr(res, err, 'when deleting operation');
    }
}
