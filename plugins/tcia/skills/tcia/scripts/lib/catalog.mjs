// Read-only views of contract/catalog.json used by the validator.

// Category -> how to list its ids (in catalog order) with their aliases.
// Scoped categories: 'palette' (palette name), 'variant' (action id),
// 'pieceVariant' (piece id), 'attribute' ("<set>.<attribute>").
export function categoryEntries(catalog, category, scope) {
  const fromObject = (obj) =>
    Object.entries(obj || {}).map(([id, v]) => ({ id, aliases: aliasList(v && v.aliases) }));
  switch (category) {
    case 'position': return fromObject(catalog.positions);
    case 'light': return fromObject(catalog.lights);
    case 'kind': return fromObject(catalog.kinds);
    case 'item': return fromObject(catalog.items);
    case 'base': return fromObject(catalog.bases);
    case 'layer': return fromObject(catalog.layers);
    case 'piece': return fromObject(catalog.pieces);
    case 'action': return fromObject(catalog.actions);
    case 'emotion': return fromObject(catalog.emotions);
    case 'palette': return fromObject(catalog.palettes[scope]);
    case 'variant': return fromObject(catalog.actions[scope] && catalog.actions[scope].variants);
    case 'height': return fromObject(catalog.actions.jump.heights);
    case 'pieceVariant': {
      const piece = catalog.pieces[scope];
      if (!piece) return [];
      return piece.variants.map((id) => ({
        id,
        aliases: aliasList(piece.variantAliases && piece.variantAliases[id]),
      }));
    }
    case 'attribute': {
      const def = attributeDef(catalog, scope);
      if (!def) return [];
      return def.palette ? fromObject(catalog.palettes[def.palette]) : fromObject(def.values);
    }
    default:
      throw new TypeError(`Unknown catalog category "${category}"`);
  }
}

function aliasList(aliases) {
  if (!aliases) return [];
  return [...(aliases.es || []), ...(aliases.en || [])];
}

export function attributeDef(catalog, scope) {
  const [set, attr] = String(scope).split('.');
  const attrs = catalog.attributeSets[set];
  return attrs ? attrs[attr] : undefined;
}

// Category of catalog.approximations that applies to a validator category.
export const APPROXIMATION_CATEGORY = {
  action: 'action',
  emotion: 'emotion',
  kind: 'kind',
  base: 'base',
  light: 'light',
  item: 'item',
};

// Words used in E_CATALOG messages: '"x" is not a valid <label>.'
export function categoryLabel(category, scope) {
  switch (category) {
    case 'palette': return scope === 'clothing' ? 'color' : `${scope} color`;
    case 'variant': return `variant of action "${scope}"`;
    case 'pieceVariant': return `variant of piece "${scope}"`;
    case 'height': return 'jump height';
    case 'attribute': return `${String(scope).split('.')[1]} value`;
    default: return category;
  }
}

export function isOnstage(catalog, position) {
  const p = catalog.positions[position];
  return Boolean(p && p.onstage);
}

export function positionOrder(catalog, position) {
  return catalog.positions[position].order;
}

// Effective look value: look -> kind defaults -> attribute set default.
export function effectiveLook(catalog, character) {
  const kind = catalog.kinds[character.kind];
  if (!kind) return null;
  const set = catalog.attributeSets[kind.attributeSet];
  const look = {};
  for (const [attr, def] of Object.entries(set)) {
    const given = character.look && character.look[attr];
    look[attr] = given !== undefined ? given : kind.defaults[attr] !== undefined ? kind.defaults[attr] : def.default;
  }
  return look;
}

// Parameters of an action once a variant is applied (D7: "Los parámetros
// siguen la tabla params de la acción y de la variante").
export function effectiveParams(action, variantId) {
  const variant = (action.variants && action.variants[variantId]) || {};
  const params = { ...action.params, ...(variant.params || {}) };
  for (const p of variant.requires || []) params[p] = 'required';
  return { params, changedByVariant: new Set([...(variant.requires || []), ...Object.keys(variant.params || {})]) };
}
