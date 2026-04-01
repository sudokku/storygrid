import React from 'react';

export const GridNodeComponent = React.memo(function GridNodeComponent({ id }: { id: string }) {
  return <div data-testid={`grid-node-${id}`} className="w-full h-full bg-[#1c1c1c]" />;
});
