/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

const CSV = "https://unpkg.com/@jpmorganchase/perspective-examples@0.2.0-beta.2/build/superstore.csv";
const ARROW = "https://unpkg.com/@jpmorganchase/perspective-examples@0.2.0-beta.2/build/superstore.arrow";

const ITERATIONS = 50;
const TOSS_ITERATIONS = 10;

const AGG_OPTIONS = [[{column: "Sales", op: "sum"}], [{column: "State", op: "dominant"}], [{column: "Order Date", op: "dominant"}]];

const COLUMN_PIVOT_OPTIONS = [[], ["Sub-Category"]];

const ROW_PIVOT_OPTIONS = [[], ["State"], ["State", "City"]];

async function* run_table_cases(worker, data, test) {
    console.log(`Benchmarking \`${test}\``);
    try {
        for (let x = 0; x < ITERATIONS + TOSS_ITERATIONS; x++) {
            const start = performance.now();
            const table = worker.table(data.slice ? data.slice() : data);
            await table.size();
            if (x >= TOSS_ITERATIONS) {
                yield {
                    test,
                    time: performance.now() - start,
                    method: test,
                    row_pivot: "n/a",
                    column_pivot: "n/a",
                    aggregate: "n/a"
                };
            }
            await table.delete();
        }
    } catch (e) {
        console.error(`Benchmark ${test} failed`, e);
    }
}

async function* run_view_cases(table, config) {
    const token = to_name(config);
    const test = `view(${JSON.stringify(token)})`;
    console.log(`Benchmarking \`${test}\``);
    for (let x = 0; x < ITERATIONS + TOSS_ITERATIONS; x++) {
        const start = performance.now();
        const view = table.view(config);
        await view.num_rows();
        if (x >= TOSS_ITERATIONS) {
            yield {
                test,
                time: performance.now() - start,
                method: "view()",
                ...token
            };
        }
        await view.delete();
    }
}

async function* run_to_format_cases(table, config, format) {
    const token = to_name(config);
    const name = `view(${JSON.stringify(token)})`;

    const view = table.view(config);
    if (!view[format]) {
        return;
    }
    await view.schema();

    console.log(`Benchmarking \`${name}.${format}()\``);
    for (let x = 0; x < ITERATIONS + TOSS_ITERATIONS; x++) {
        const start = performance.now();
        await view[format]();
        if (x >= TOSS_ITERATIONS) {
            yield {
                time: performance.now() - start,
                test: `${format}(${name})`,
                method: `${format}()`,
                ...token
            };
        }
    }

    await view.delete();
}

async function initialize(worker) {
    const req1 = fetch(CSV);
    const req2 = fetch(ARROW);

    console.log("Downloading CSV");
    let content = await req1;
    const csv = await content.text();

    console.log("Downloading Arrow");
    content = await req2;
    const arrow = await content.arrayBuffer();

    console.log("Generating JSON");
    const tbl = worker.table(arrow.slice());
    const view = tbl.view();
    const rows = await view.to_json();
    const columns = await view.to_columns();
    view.delete();
    tbl.delete();

    return {csv, arrow, rows, columns};
}

const COLUMN_TYPES = {Sales: "number", "Order Date": "datetime", State: "string"};

function to_name({aggregate, row_pivot, column_pivot}) {
    return {
        aggregate: COLUMN_TYPES[aggregate[0].column],
        row_pivot: row_pivot.join("/") || "-",
        column_pivot: column_pivot.join("/") || "-"
    };
}

const wait_for_perspective = () => new Promise(resolve => window.addEventListener("perspective-ready", resolve));

async function* run_all_cases() {
    const worker = window.perspective.worker();
    await wait_for_perspective();
    const {csv, arrow, rows, columns} = await initialize(worker);
    console.assert(rows.length === columns[Object.keys(columns)[0]].length);

    yield* run_table_cases(worker, csv, "table(csv)");
    yield* run_table_cases(worker, arrow, "table(arrow)");
    yield* run_table_cases(worker, rows, "table(row json)");
    yield* run_table_cases(worker, columns, "table(column json)");

    const table = worker.table(arrow);
    await table.schema();

    for (const aggregate of AGG_OPTIONS) {
        for (const row_pivot of ROW_PIVOT_OPTIONS) {
            for (const column_pivot of COLUMN_PIVOT_OPTIONS) {
                const config = {aggregate, row_pivot, column_pivot};

                yield* run_view_cases(table, config);
                yield* run_to_format_cases(table, config, "to_json");
                yield* run_to_format_cases(table, config, "to_columns");
                yield* run_to_format_cases(table, config, "to_arrow");
            }
        }
    }
}

async function run_test() {
    perspective = perspective.default || perspective;
    try {
        let results = [];
        for await (let c of run_all_cases()) {
            results.push(c);
        }
        return results;
    } catch (e) {
        console.error(e.message);
        return [];
    }
}
