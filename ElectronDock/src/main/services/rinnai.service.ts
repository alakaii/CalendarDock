// Rinnai Control-R WiFi — AWS Cognito SRP auth + AppSync GraphQL + IoT Shadow
// Based on reverse-engineering by explosivo22/rinnaicontrolr
import type { RinnaiDevice } from '../../preload/types'

// Polyfill crypto for amazon-cognito-identity-js in Node.js main process
import { webcrypto } from 'crypto'
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto
}

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js'

const USER_POOL_ID = 'us-east-1_OcwpRQbMM'
const CLIENT_ID    = '5ghq3i6k4p9s7dfu34ckmec91'
const GRAPHQL_URL  = 'https://s34ox7kri5dsvdr43bfgp6qh6i.appsync-api.us-east-1.amazonaws.com/graphql'
const SHADOW_BASE  = 'https://698suy4zs3.execute-api.us-east-1.amazonaws.com/Prod/thing'
const API_KEY      = 'da2-dm2g4rqvjbaoxcpo4eccs3k5he'

const userPool = new CognitoUserPool({ UserPoolId: USER_POOL_ID, ClientId: CLIENT_ID })

interface TokenCache {
  idToken: string
  accessToken: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

function authenticate(email: string, password: string): Promise<TokenCache> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool })
    const authDetails = new AuthenticationDetails({ Username: email, Password: password })

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => {
        resolve({
          idToken:     session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          expiresAt:   session.getIdToken().getExpiration() * 1000,
        })
      },
      onFailure: (err) => reject(new Error(err.message || 'Rinnai auth failed')),
    })
  })
}

async function getTokens(email: string, password: string): Promise<TokenCache> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache
  }
  tokenCache = await authenticate(email, password)
  return tokenCache
}

async function graphql(token: string, query: string, variables: Record<string, unknown> = {}, bearerPrefix = false, includeApiKey = false) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': bearerPrefix ? `Bearer ${token}` : token,
    'x-amz-user-agent': 'aws-amplify/3.4.3 react-native',
  }
  if (includeApiKey) headers['x-api-key'] = API_KEY
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json() as any
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data
}


const GET_USER_BY_EMAIL_QUERY = `
  query GetUserByEmail($email: String) {
    getUserByEmail(email: $email) {
      items {
        devices {
          items {
            thing_name
            device_name
            shadow {
              set_domestic_temperature
              recirculation_enabled
            }
            info {
              domestic_combustion
              domestic_temperature
              recirculation_temperature
              m02_outlet_temperature
              m08_inlet_temperature
            }
          }
        }
      }
    }
  }
`

export const rinnaiService = {
  async getDevices(email: string, password: string): Promise<RinnaiDevice[]> {
    const tokens = await getTokens(email, password)

    const data = await graphql(tokens.idToken, GET_USER_BY_EMAIL_QUERY, { email }, false, true)
    const userItems = data?.getUserByEmail?.items ?? []
    const items = userItems.flatMap((u: any) => u.devices?.items ?? [])
    console.log('[rinnai] raw device items:', JSON.stringify(items, null, 2))
    return items.map((d: any): RinnaiDevice => ({
      thingName: d.thing_name,
      name: d.device_name || d.thing_name,
      setTemp: Number(d.shadow?.set_domestic_temperature ?? 120),
      isHeating: d.info?.domestic_combustion === 'true',
      recirculationEnabled: d.shadow?.recirculation_enabled === true,
      domesticTemperature:      d.info?.domestic_temperature      != null ? Number(d.info.domestic_temperature)      : undefined,
      recirculationTemperature: d.info?.recirculation_temperature != null ? Number(d.info.recirculation_temperature) : undefined,
      outletTemperature:        d.info?.m02_outlet_temperature    != null ? Number(d.info.m02_outlet_temperature)    : undefined,
      inletTemperature:         d.info?.m08_inlet_temperature     != null ? Number(d.info.m08_inlet_temperature)     : undefined,
    }))
  },

  async setTemperature(email: string, password: string, thingName: string, temp: number): Promise<void> {
    const { idToken } = await getTokens(email, password)
    const res = await fetch(`${SHADOW_BASE}/${thingName}/shadow`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'okhttp/3.12.1',
      },
      body: JSON.stringify({ set_domestic_temperature: temp }),
    })
    if (!res.ok) throw new Error(`Rinnai set-temp failed: ${res.status}`)
  },

  async setRecirculation(
    email: string,
    password: string,
    thingName: string,
    enabled: boolean,
    durationMinutes = 15
  ): Promise<void> {
    const { idToken } = await getTokens(email, password)
    const res = await fetch(`${SHADOW_BASE}/${thingName}/shadow`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'okhttp/3.12.1',
      },
      body: JSON.stringify({
        set_recirculation_enabled: enabled,
        ...(enabled ? { recirculation_duration: String(durationMinutes) } : {}),
      }),
    })
    if (!res.ok) throw new Error(`Rinnai recirculation failed: ${res.status}`)
  },
}
