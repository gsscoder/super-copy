import path from 'node:path';
import { getDestinations, addDestination, removeDestination, destinationExists } from '../config.js';
import { validateLocalPath } from '../validate.js';
import { success, error, dim, printDestinationList } from '../ui.js';
function handleAdd(name, location) {
    if (destinationExists(name)) {
        error(`destination "${name}" already exists`);
        return;
    }
    const result = validateLocalPath(location);
    if (!result.valid) {
        error(result.error ?? 'invalid local path');
        return;
    }
    addDestination({ name, location: path.resolve(location) });
    success(`Destination "${name}" added`);
}
function handleRemove(name) {
    if (!destinationExists(name)) {
        error(`destination "${name}" not found`);
        return;
    }
    removeDestination(name);
    success(`Destination "${name}" removed`);
}
function handleList() {
    const destinations = getDestinations();
    if (destinations.length === 0) {
        dim('No destinations registered');
        return;
    }
    printDestinationList(destinations);
}
export default function register(program) {
    const dest = program
        .command('dest')
        .description('Manage asset destinations');
    dest
        .command('add')
        .description('Add a destination (local path)')
        .argument('<name>', 'Destination name')
        .argument('<location>', 'Local filesystem path')
        .action(handleAdd);
    dest
        .command('remove')
        .description('Remove a destination by name')
        .argument('<name>', 'Destination name')
        .action(handleRemove);
    dest
        .command('list')
        .description('List all registered destinations')
        .action(handleList);
}
//# sourceMappingURL=dest.js.map