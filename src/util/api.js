/* eslint-disable no-nested-ternary */

import upperFirst from 'lodash.upperfirst'

import { get } from './http'
import { mapToApiOffense } from './offenses'
import { oriToState } from './agencies'
import { slugify } from './text'
import agencyApi from './api/agency'
import participationApi from './api/participation'
import lookupsApi from './api/lookups'

export const API = '/api-proxy'
export const nationalKey = 'united-states'

const dimensionEndpoints = {
  ageNum: 'age_num',
  locationName: 'location_name',
  offenseName: 'offense_name',
  raceCode: 'race_code',
  relationship: 'offender_relationship',
  sexCode: 'sex_code',
}

const fetchNibrs = ({ crime, dim, place, placeType, type, placeId }) => {
  const loc =
    place === nationalKey
      ? 'national'
      : placeType === 'agency'
        ? `agencies/${place}`
        : `states/${placeId}`

  const field = dimensionEndpoints[dim] || dim
  const fieldPath = dim === 'offenseName' ? field : `${field}/offenses`
  const url = `${API}/${type}s/count/${loc}/${fieldPath}`

  const params = {
    size: 50,
    aggregate_many: false,
    explorer_offense: mapToApiOffense(crime),
  }

  return get(url, params).then(d => ({
    key: `${type}${upperFirst(dim)}`,
    data: d.results,
  }))
}

const getNibrsRequests = params => {
  const { crime, place, placeType, placeId } = params

  const slices = [
    { type: 'offender', dim: 'ageNum' },
    { type: 'offender', dim: 'ethnicity' },
    { type: 'offender', dim: 'raceCode' },
    { type: 'offender', dim: 'sexCode' },
    { type: 'offense', dim: 'locationName' },
    { type: 'offense', dim: 'offenseName' },
    { type: 'victim', dim: 'ageNum' },
    { type: 'victim', dim: 'ethnicity' },
    { type: 'victim', dim: 'raceCode' },
    { type: 'victim', dim: 'sexCode' },
    { type: 'victim', dim: 'relationship' },
  ]

  return slices.map(s => fetchNibrs({ ...s, crime, place, placeType, placeId }))
}

const fetchResults = (key, path) =>
  get(`${API}/${path}?size=500`).then(response => ({
    key,
    results: response.results,
  }))

const parsePoliceEmployment = ([policeEmployment]) => ({
  ...policeEmployment,
  results: policeEmployment.results.map(datum => ({
    ...datum,
  })),
})

const fetchPoliceEmployment = (place, placeType, placeId) => {
  let peApi
  if (placeType === 'state') {
    peApi = `api/police-employment/states/${placeId}`
  } else if (placeType === 'agency') {
    peApi = `api/police-employment/agencies/${place}`
  } else if (placeType === 'region') {
    peApi = `api/police-employment/regions/${place}`
  } else {
    peApi = 'api/police-employment/national'
  }
  const requests = [
    fetchResults(place || nationalKey, peApi),
  ]
    return Promise.all(requests).then(parsePoliceEmployment)
}

const getPoliceEmploymentRequests = filters => [fetchPoliceEmployment(filters.place, filters.placeType, filters.placeId), fetchPoliceEmployment()]

const fetchArson = (place, placeId, placeType) => {
  let url
  if (placeType === 'state') {
    url = `${API}/api/arson/states/${placeId}?size=50`
  } else if (placeType === 'region') {
    url = `${API}/api/arson/regions/${place}?size=50`
  } else {
    url = `${API}/api/arson/national?size=50`
  }

  return get(url).then(({ results }) =>
    results.map(d => ({ year: d.year, arson: d.actual })),
  )
}

const parseAggregates = ([estimates, arsons]) => ({
  ...estimates,
  results: estimates.results.map(datum => ({
    ...datum,
    arson: (arsons.find(a => a.year === datum.year) || {}).arson,
  })),
})

const fetchAggregates = (place, placeType, placeId) => {
  let estimatesApi
  if (placeType === 'state') {
    estimatesApi = `api/estimates/states/${placeId}`
  } else if (placeType === 'region') {
    estimatesApi = `api/estimates/regions/${place}`
  } else {
    estimatesApi = 'api/estimates/national'
  }

  const requests = [
    fetchResults(place || nationalKey, estimatesApi),
    fetchArson(place, placeId, placeType),
  ]

  return Promise.all(requests).then(parseAggregates)
}

const fetchAgencyAggregates = (ori, crime) => {
  const params = { explorer_offense: mapToApiOffense(crime), size: 200 }
  return agencyApi.getAgencyOffenses(ori, params).then(d => ({ key: ori, results: d.results }))
}

const getSummaryRequests = ({ crime, place, placeType, placeId }) => {
  if (placeType === 'agency') {
    const stateName = slugify(oriToState(place))
    return [
      fetchAgencyAggregates(place, crime),
      fetchAggregates(stateName, placeType, placeId),
      fetchAggregates(),
    ]
  }
  return [fetchAggregates(place, placeType, placeId), fetchAggregates()]
}

const getUcrParticipation = (place, placeId, placeType) => {
  let api

  if (place === nationalKey) {
    api = participationApi.getNationalParticipation()
  } else if (placeType === 'region') {
    api = participationApi.getRegionalParticipation(place)
  } else if (placeType === 'state') {
    api = participationApi.getStateParticipation(placeId)
  } else if (placeType === 'agency') {
    api = participationApi.getAgencyParticipation(placeId)
  } else {
    api = participationApi.getNationalParticipation();
  }

  return api.then(response => ({
    place,
    results: response.results,
  }))
}

const getUcrParticipationRequests = filters => {
  const { place, placeType, placeId } = filters

  const requests = [getUcrParticipation(place, placeId, placeType)]

  // add national request (unless you already did)
  if (place !== nationalKey) {
    requests.push(getUcrParticipation(nationalKey))
  }

  return requests
}


const getUcrRegions = () =>
  lookupsApi.getRegions().then(r => ({
    results: r.results,
  }))

const getUcrRegionRequests = () => {
  const requests = [];
  requests.push(getUcrRegions())

  return requests
}


const getUcrStates = () =>
  lookupsApi.getStates({ size: 100 }).then(r => ({
    results: r.results,
  }))

const getUcrStatesRequests = () => {
  const requests = [];
  requests.push(getUcrStates())

  return requests
}

export const formatError = error => ({
  code: error.response.status,
  message: error.message,
  url: error.config.url,
})

const fetchNibrsCounts = ({ dim, place, placeType, type, placeId }) => {
  const loc =
    place === nationalKey
      ? 'national'
      : placeType === 'agency'
        ? `agencies/${place}`
        : `states/${placeId}`

  const field = dimensionEndpoints[dim] || dim
  let url
  if (field !== '') { url = `${API}/api/nibrs/${type}/${loc}/${field}` } else { url = `${API}/api/nibrs/${type}/${loc}` }


  const params = {
    size: 1000,
    aggregate_many: false,
  }

  return get(url, params).then(d => ({
    key: `${type}${upperFirst(dim)}`,
    data: d.results,
  }))
}

const getNibrsCountsRequests = params => {
  const { pageType, place, placeType, placeId } = params

  const slices = [
    { type: 'offender', dim: '' },
    { type: 'offender', dim: 'age' },
    { type: 'offender', dim: 'sex' },
    { type: 'offender', dim: 'race' },
    { type: 'offender', dim: 'ethnicity' },
    { type: 'victim', dim: '' },
    { type: 'victim', dim: 'age' },
    { type: 'victim', dim: 'ethnicity' },
    { type: 'victim', dim: 'race' },
    { type: 'victim', dim: 'sex' },
    { type: 'victim', dim: 'location' },
    { type: 'victim', dim: 'relationships' },
    { type: 'offense', dim: '' },

  ]
  return slices.map(s => fetchNibrsCounts({ ...s, pageType, place, placeType, placeId }))
}

const fetchLeoka = ({ dim, place, placeType, placeId, pageType }) => {
  const loc =
    place === nationalKey
      ? 'national'
      : placeType === 'agency'
        ? `agencies/${place}`
        : `states/${placeId}`

  const url = `${API}/leoka/${pageType}/${dim}/count/${loc}`;

  const params = {
    size: 1000,
    aggregate_many: false,
  }

  return get(url, params).then(d => ({
    key: `${pageType}${upperFirst(dim)}`,
    data: d.results,
  }))
}

const getLeokaRequests = params => {
  const { pageType, place, placeType, placeId } = params

  const slices = [
    { dim: 'group' },
    { dim: 'assign-dist' },
    { dim: 'weapon' },
  ]

  if (placeType !== 'agency') {
    slices.push({ dim: 'weapon-group' })
    slices.push({ dim: 'weapon-activity' })
  }
  return slices.map(s => fetchLeoka({ ...s, pageType, place, placeType, placeId }))
}

export default {
  fetchAggregates,
  fetchAgencyAggregates,
  fetchNibrs,
  getNibrsRequests,
  fetchNibrsCounts,
  getNibrsCountsRequests,
  getPoliceEmploymentRequests,
  getSummaryRequests,
  getUcrParticipation,
  getUcrParticipationRequests,
  getUcrRegions,
  getUcrRegionRequests,
  getUcrStates,
  getUcrStatesRequests,
  getLeokaRequests,
}
