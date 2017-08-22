import range from 'lodash.range';
import lowerCase from 'lodash.lowercase';
import PropTypes from 'prop-types';
import React from 'react';

import Highlight from '../Highlight';
import Term from '../Term';
import crimeTerm from '../../util/glossary';
import { formatNum, formatOneDec as formatRate } from '../../util/formats';
import lookupUsa, { nationalKey } from '../../util/usa';

const highlight = txt =>
  <strong>
    {txt}
  </strong>;
const borderColor = { borderColor: '#c8d3dd' };
const cellStyle = { width: 68, ...borderColor };

const getComparison = ({ place, data }) => {
  const threshold = 3;
  let placeRate;
  let nationalRate;
  for (let i = 0; i < data.length; i++) {
    if (data[i].place === place) {
      placeRate = data[i].rate;
    } else {
      nationalRate = data[i].rate;
    }
  }
  const diff = (placeRate / nationalRate - 1) * 100;

  return Math.abs(diff) < threshold
    ? <span>
        about the same (within {threshold}%) as
      </span>
    : <span>
        {<Highlight text={`${diff > 0 ? 'higher' : 'lower'}`} />} than
      </span>;
};

const OffenseTrendChartDetails = ({
  active,
  colors,
  crime,
  keys,
  since,
  until,
  updateYear,
}) => {
  console.log('OffenseTrendChartDetails init');
  const handleSelectChange = e => updateYear(Number(e.target.value));
  const yearRange = range(since, until + 1);
  const term = (
    <Term id={crimeTerm(crime)} size="sm">
      {lowerCase(crime)}
    </Term>
  );
  console.log('OffenseTrendChartDetails active', active);
  const data = active.filter(d => d.crime !== 'rape-revised');
  console.log('OffenseTrendChartDetails data', data);
  const isNational = keys.length === 1;
  const place = isNational ? nationalKey : keys.find(k => k !== nationalKey);
  const comparison = getComparison({ place, data });
  const { rate, year } = data.find(d => d.place === place) || {};
  const revised = active.find(
    d => d.crime === 'rape-revised' && d.place === place,
  );

  let sentence;
  if (isNational) {
    sentence = (
      <span>
        In {highlight(year)}, there were {highlight(formatRate(rate))} incidents
        of {term} per 100,000 people.
      </span>
    );
  } else if (crime === 'rape' && revised && revised.rate) {
    sentence = (
      <span>
        In {highlight(year)}, the rate at which rape was reported using the{' '}
        <Term id={crimeTerm('rape')} size="sm">
          legacy
        </Term>{' '}
        definition was {highlight(formatRate(rate))} per 100,000. Rape was
        reported using the{' '}
        <Term id={crimeTerm('rape-revised')} size="sm">
          revised
        </Term>{' '}
        definition at a rate of {highlight(formatRate(revised.rate))} per
        100,000 people.
      </span>
    );
  } else {
    sentence = (
      <span>
        In {highlight(year)}, {lookupUsa(place).display}’s {term} rate was{' '}
        {highlight(formatRate(rate))} incidents per 100,000 people. The rate for
        that year was {comparison} that of the United States.
      </span>
    );
  }

  return (
    <div>
      <div className="flex-none">
        <p className="sm-p3 fs-12">
          {sentence}
        </p>
      </div>
      <div className="flex-none inline-block mw-fill overflow-auto">
        <table className="p2 sm-col-5">
          <thead className="fs-10 line-height-4 right-align">
            <tr>
              <td className="left-align">
                <label htmlFor="year-selected" className="hide">
                  Year selected
                </label>
              </td>
              <td className="pr1 align-middle">Rate</td>
              <td className="pr1 align-middle">Total</td>
            </tr>
          </thead>
          <tbody className="fs-12 bold line-height-4">
            {data.map((d, i) =>
              <tr key={i}>
                <td
                  className="pr2 nowrap truncate align-bottom"
                  style={{ maxWidth: 125 }}
                >
                  <span
                    className="mr1 inline-block circle"
                    style={{
                      width: 8,
                      height: 8,
                      backgroundColor: colors[i] || '#000',
                    }}
                  />
                  {lookupUsa(d.place).display}
                </td>
                <td className="pt1 pr2 align-bottom right-align">
                  <span
                    className="inline-block border-bottom"
                    style={cellStyle}
                  >
                    {formatRate(d.rate)}
                  </span>
                </td>
                <td className="pt1 pr2 align-bottom right-align">
                  <span
                    className="inline-block border-bottom"
                    style={cellStyle}
                  >
                    {formatNum(d.count)}
                  </span>
                </td>
              </tr>,
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

OffenseTrendChartDetails.propTypes = {
  active: PropTypes.arrayOf(PropTypes.object).isRequired,
  colors: PropTypes.arrayOf(PropTypes.string).isRequired,
  crime: PropTypes.string.isRequired,
  since: PropTypes.number.isRequired,
  until: PropTypes.number.isRequired,
  updateYear: PropTypes.func.isRequired,
};

export default OffenseTrendChartDetails;