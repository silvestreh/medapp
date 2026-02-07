import { HookContext } from '@feathersjs/feathers';
import { Op, Sequelize } from 'sequelize';

export const searchTree = () => {
  return async (context: HookContext) => {
    const { params, app } = context;
    const { query = {} } = params;

    if (!query.$search) {
      return context;
    }

    const searchTerm = query.$search;
    delete query.$search;

    const Model = app.service('icd-10').Model;
    const sequelize: Sequelize = app.get('sequelizeClient');

    // Normalize search term: lowercase and remove accents
    const normalizedSearch = searchTerm
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // We use unaccent in Postgres if available, or ILIKE with wildcards
    // For simplicity and robustness across environments, we'll use ILIKE with normalized search if we had a searchable column,
    // but since we want to handle accents, we'll use a more complex query or assume unaccent extension exists.
    // Let's use a query that handles both code and name.
    
    // Find matching nodes
    const matches = await Model.findAll({
      where: {
        [Op.or]: [
          { id: { [Op.iLike]: `%${searchTerm}%` } },
          Sequelize.where(
            Sequelize.fn('unaccent', Sequelize.col('name')),
            { [Op.iLike]: `%${normalizedSearch}%` }
          )
        ]
      },
      raw: true
    });

    if (matches.length === 0) {
      context.result = {
        expandedIds: [],
        selectedIds: [],
        data: [],
        focusedId: null
      };
      return context;
    }

    // Get all ancestors for all matches to build the tree context
    const allNodeIds = new Set<string>();
    const expandedIds = new Set<string>();
    const dataMap = new Map<string, any>();

    const fetchAncestors = async (node: any) => {
      if (dataMap.has(node.id)) return;
      dataMap.set(node.id, node);
      allNodeIds.add(node.id);

      if (node.parent) {
        expandedIds.add(node.parent);
        const parentNode = await Model.findByPk(node.parent, { raw: true });
        if (parentNode) {
          await fetchAncestors(parentNode);
        }
      }
    };

    for (const match of matches) {
      await fetchAncestors(match);
    }

    // Also include children of the matches so they can be expanded
    // (Optional, but helpful for UX)
    for (const match of matches) {
      if (match.children && match.children.length > 0) {
        const childrenNodes = await Model.findAll({
          where: { id: { [Op.in]: match.children } },
          raw: true
        });
        for (const child of childrenNodes) {
          if (!dataMap.has(child.id)) {
            dataMap.set(child.id, child);
          }
        }
      }
    }

    context.result = {
      expandedIds: Array.from(expandedIds),
      selectedIds: [],
      data: Array.from(dataMap.values()),
      focusedId: matches[0].id // Focus the first match
    };

    return context;
  };
};
