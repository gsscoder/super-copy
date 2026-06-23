import { getSources, getDestinations } from '../config.js';
import { heading, dim, printSourceList, printDestinationList } from '../ui.js';
function handleList() {
    const sources = getSources();
    const destinations = getDestinations();
    heading('sources');
    if (sources.length === 0) {
        dim('no sources registered');
    }
    else {
        printSourceList(sources);
    }
    heading('destinations');
    if (destinations.length === 0) {
        dim('no destinations registered');
    }
    else {
        printDestinationList(destinations);
    }
}
export default function register(program) {
    program
        .command('list')
        .description('List all registered sources and destinations')
        .action(handleList);
}
//# sourceMappingURL=list.js.map