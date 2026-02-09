import { useState, useEffect } from 'react';
import { TextInput, Popover, ScrollArea, Box, Text, Loader, ActionIcon, Stack } from '@mantine/core';
import { ChevronRight, ChevronDown, Search, X, Check } from 'lucide-react';
import { useFeathers } from '~/components/provider';
import { useTranslation } from 'react-i18next';
import { styled } from '~/stitches';

const NodeContainer = styled('div', {
  padding: '4px 8px',
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'background-color 0.2s ease',
  userSelect: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',

  '&:hover': {
    backgroundColor: 'var(--mantine-color-gray-0)',
  },

  variants: {
    selected: {
      true: {
        backgroundColor: 'var(--mantine-color-blue-0)',
        color: 'var(--mantine-color-blue-7)',
      },
    },
  },
});

const TreeIcon = styled('div', {
  color: 'var(--mantine-color-gray-5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '16px',
  flexShrink: 0,
});

const NodeText = styled('div', {
  flex: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: 'var(--mantine-font-size-sm)',

  '& b': {
    color: 'var(--mantine-color-black)',
    fontWeight: 700,
  },
});

interface Icd10Node {
  id: string;
  name: string;
  parent: string | null;
  children: string[];
  isBranch?: boolean;
}

interface Icd10SelectorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  readOnly?: boolean;
}

export function Icd10Selector({ value, onChange, placeholder, label, error, readOnly }: Icd10SelectorProps) {
  const { t } = useTranslation();
  const client = useFeathers();
  const [opened, setOpened] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [nodes, setNodes] = useState<Record<string, Icd10Node>>({});
  const [rootIds, setRootIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchValue]);

  // Fetch initial root nodes or search
  useEffect(() => {
    const fetchData = async () => {
      if (!client || !opened || readOnly) return;
      setLoading(true);
      try {
        if (debouncedSearch) {
          const result = await client.service('icd-10').find({
            query: { $search: debouncedSearch },
          });

          if (result.data) {
            const newNodes: Record<string, Icd10Node> = {};
            result.data.forEach((node: any) => {
              newNodes[node.id] = {
                ...node,
                isBranch: !!(node.children && node.children.length > 0),
              };
            });
            setNodes(newNodes);
            setRootIds(result.data.filter((n: any) => !n.parent || !newNodes[n.parent]).map((n: any) => n.id));
            setExpandedIds(new Set(result.expandedIds || []));
          }
        } else {
          const result = await client.service('icd-10').find({
            query: { parent: null, $limit: 50 },
          });

          const newNodes: Record<string, Icd10Node> = {};
          result.data.forEach((node: any) => {
            newNodes[node.id] = {
              ...node,
              isBranch: !!(node.children && node.children.length > 0),
            };
          });
          setNodes(newNodes);
          setRootIds(result.data.map((n: any) => n.id));
          setExpandedIds(new Set());
        }
      } catch (err) {
        console.error('Error fetching ICD-10 data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [client, opened, debouncedSearch, readOnly]);

  // Fetch selected name if value changes
  useEffect(() => {
    const fetchSelectedName = async () => {
      if (value && client) {
        try {
          const node = await client.service('icd-10').get(value);
          if (node) {
            setSelectedName(`${node.id} - ${node.name}`);
          } else {
            setSelectedName(value);
          }
        } catch (err) {
          console.error('Error fetching selected ICD-10 node:', err);
          setSelectedName(value);
        }
      } else {
        setSelectedName('');
      }
    };
    fetchSelectedName();
  }, [value, client]);

  const toggleExpand = async (nodeId: string) => {
    const isExpanded = expandedIds.has(nodeId);
    const newExpanded = new Set(expandedIds);

    if (isExpanded) {
      newExpanded.delete(nodeId);
      setExpandedIds(newExpanded);
    } else {
      newExpanded.add(nodeId);
      setExpandedIds(newExpanded);

      // Load children if not already loaded
      const node = nodes[nodeId];
      if (node && node.children.length > 0 && !node.children.some(id => !!nodes[id])) {
        setLoading(true);
        try {
          const result = await client.service('icd-10').find({
            query: { parent: nodeId },
          });

          setNodes(prev => {
            const updated = { ...prev };
            result.data.forEach((n: any) => {
              updated[n.id] = {
                ...n,
                isBranch: !!(n.children && n.children.length > 0),
              };
            });
            return updated;
          });
        } catch (err) {
          console.error('Error loading children:', err);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleSelect = (node: Icd10Node) => {
    onChange(node.id);
    setOpened(false);
  };

  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return text;

    const terms = search
      .trim()
      .split(/\s+/)
      .filter(term => term.length > 0)
      .map(term =>
        term
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
      );

    if (terms.length === 0) return text;

    // Create a regex that matches any of the terms, but we need to handle accents in the source text
    // A simpler way is to find all matches by normalizing the text for comparison
    const normalizedText = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const matches: { start: number; end: number }[] = [];

    terms.forEach(term => {
      let pos = normalizedText.indexOf(term);
      while (pos !== -1) {
        matches.push({ start: pos, end: pos + term.length });
        pos = normalizedText.indexOf(term, pos + 1);
      }
    });

    if (matches.length === 0) return text;

    // Merge overlapping matches
    const mergedMatches = matches
      .sort((a, b) => a.start - b.start)
      .reduce(
        (acc, curr) => {
          if (acc.length === 0) return [curr];
          const last = acc[acc.length - 1];
          if (curr.start <= last.end) {
            last.end = Math.max(last.end, curr.end);
            return acc;
          }
          return [...acc, curr];
        },
        [] as { start: number; end: number }[]
      );

    const result: (string | React.ReactNode)[] = [];
    let lastIndex = 0;

    mergedMatches.forEach((match, i) => {
      result.push(text.slice(lastIndex, match.start));
      result.push(<b key={i}>{text.slice(match.start, match.end)}</b>);
      lastIndex = match.end;
    });
    result.push(text.slice(lastIndex));

    return result;
  };

  const renderNode = (nodeId: string, level: number = 0) => {
    const node = nodes[nodeId];
    if (!node) return null;

    const isExpanded = expandedIds.has(nodeId);
    const hasChildren = node.isBranch;

    return (
      <Box key={nodeId}>
        <NodeContainer
          selected={value === nodeId}
          style={{ paddingLeft: level * 20 + 8 }}
          onClick={() => {
            if (hasChildren) {
              toggleExpand(nodeId);
            } else {
              handleSelect(node);
            }
          }}
        >
          <TreeIcon>
            {hasChildren ? isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : null}
          </TreeIcon>
          <NodeText>{highlightText(`${node.id} - ${node.name}`, debouncedSearch)}</NodeText>
          {value === nodeId && <Check size={14} color="var(--mantine-color-blue-6)" />}
        </NodeContainer>

        {isExpanded && node.children && <Box>{node.children.map(childId => renderNode(childId, level + 1))}</Box>}
      </Box>
    );
  };

  return (
    <Box>
      <Popover
        opened={opened && !readOnly}
        onChange={setOpened}
        width="target"
        position="bottom-start"
        offset={0}
        styles={{ dropdown: { padding: 0 } }}
        disabled={readOnly}
      >
        <Popover.Target>
          <TextInput
            label={label}
            placeholder={placeholder || t('forms.consulta_internacion_placeholder_reason')}
            value={opened && !readOnly ? searchValue : selectedName}
            onChange={e => {
              if (readOnly) return;
              setSearchValue(e.currentTarget.value);
              if (!opened) setOpened(true);
            }}
            variant="unstyled"
            styles={{
              input: {
                minHeight: '1.5rem',
                height: 'auto',
                lineHeight: 1.75,
                cursor: readOnly ? 'default' : 'text',
              },
            }}
            onFocus={() => !readOnly && setOpened(true)}
            readOnly={readOnly}
            tabIndex={readOnly ? -1 : 0}
            error={error}
            rightSection={
              loading ? (
                <Loader size="xs" />
              ) : value && !readOnly ? (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={e => {
                    e.stopPropagation();
                    onChange('');
                    setSearchValue('');
                  }}
                >
                  <X size={16} />
                </ActionIcon>
              ) : !readOnly ? (
                <Search size={16} color="gray" />
              ) : null
            }
          />
        </Popover.Target>
        {!readOnly && (
          <Popover.Dropdown>
            <ScrollArea.Autosize mah={400} type="auto">
              <Box p="xs">
                {rootIds.length === 0 && !loading && (
                  <Text size="sm" c="dimmed" ta="center" py="xl">
                    {t('common.no_results')}
                  </Text>
                )}
                <Stack gap={2}>{rootIds.map(id => renderNode(id))}</Stack>
              </Box>
            </ScrollArea.Autosize>
          </Popover.Dropdown>
        )}
      </Popover>
    </Box>
  );
}
