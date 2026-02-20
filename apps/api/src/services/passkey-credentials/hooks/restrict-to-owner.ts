export const restrictToOwner = () => (context: any) => {
  const userId = context.params?.user?.id;
  if (!userId) return context;

  if (context.method === 'find') {
    context.params.query = { ...context.params.query, userId };
  }

  return context;
};
