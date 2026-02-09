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

    // Split search term into words and normalize each
    const searchWords = searchTerm
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/)
      .filter((word: string) => word.length > 0);

    if (searchWords.length === 0) {
      return context;
    }

    // Build a query where EACH word must match either the ID or the unaccented Name
    const wordConditions = searchWords.map((word: string) => {
      return {
        [Op.or]: [
          { id: { [Op.iLike]: `%${word}%` } },
          Sequelize.where(
            Sequelize.fn('unaccent', Sequelize.col('name')),
            { [Op.iLike]: `%${word}%` }
          )
        ]
      };
    });

    // Find matching nodes that satisfy ALL word conditions
    const matches = await Model.findAll({
      where: {
        [Op.and]: wordConditions
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
