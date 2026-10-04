import type { Route } from './router'
import { ORDER_ROUTES } from './order-routes'
import { CATALOG_ROUTES } from './catalog-routes'
import { SETTINGS_ROUTES } from './settings-routes'

export const ROUTES: Route[] = [...ORDER_ROUTES, ...CATALOG_ROUTES, ...SETTINGS_ROUTES]
