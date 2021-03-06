/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import * as fc from "d3fc";
import * as crossAxis from "../axis/crossAxis";
import * as mainAxis from "../axis/mainAxis";
import {barSeries} from "../series/barSeries";
import {seriesColors} from "../series/seriesColors";
import {groupAndStackData} from "../data/groupData";
import {colorLegend} from "../legend/legend";
import {filterData} from "../legend/filter";
import {withGridLines} from "../gridlines/gridlines";

import {hardLimitZeroPadding} from "../d3fc/padding/hardLimitZero";
import zoomableChart from "../zoom/zoomableChart";

function barChart(container, settings) {
    const data = groupAndStackData(settings, filterData(settings));
    const color = seriesColors(settings);

    const legend = colorLegend()
        .settings(settings)
        .scale(color);

    const series = fc
        .seriesSvgMulti()
        .mapping((data, index) => data[index])
        .series(
            data.map(() =>
                barSeries(settings, color)
                    .align("left")
                    .orient("horizontal")
            )
        );

    const yDomain = crossAxis
        .domain(settings)(data)
        .reverse();
    const yScale = crossAxis.scale(settings);
    const yAxis = crossAxis
        .axisFactory(settings)
        .domain(yDomain)
        .orient("vertical")();

    const chart = fc
        .chartSvgCartesian({
            xScale: mainAxis.scale(settings),
            yScale,
            yAxis
        })
        .xDomain(
            mainAxis
                .domain(settings)
                .include([0])
                .paddingStrategy(hardLimitZeroPadding())(data)
        )
        .xLabel(mainAxis.label(settings))
        .yDomain(yDomain)
        .yLabel(crossAxis.label(settings))
        .yAxisWidth(yAxis.size)
        .yDecorate(yAxis.decorate)
        .yOrient("left")
        .xNice()
        .plotArea(withGridLines(series).orient("horizontal"));

    chart.yPaddingInner && chart.yPaddingInner(0.5);
    chart.yPaddingOuter && chart.yPaddingOuter(0.25);

    const zoomChart = zoomableChart()
        .chart(chart)
        .settings(settings)
        .yScale(yScale);

    // render
    container.datum(data).call(zoomChart);
    container.call(legend);
}
barChart.plugin = {
    type: "d3_x_bar",
    name: "[d3fc] X Bar Chart",
    max_size: 25000
};

export default barChart;
