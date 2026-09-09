/**
 * useVirtualList — Taro React Hook
 *
 * Provides the same high-performance chunk-based virtualization as
 * the native virtualListBehavior, but as a React hook for Taro projects.
 *
 * Usage:
 *   import { useVirtualList } from 'miniprogram-virtual-list/taro';
 *
 *   function MyPage() {
 *     const [items, setItems] = useState(generateItems(0, 1000));
 *     const { vlChunks, vlVisible, vlStyles, vlActiveIndex, vlScrollTo, vlScrollToItem } = useVirtualList({
 *       items,
 *       itemHeight: 80,
 *       chunkSize: 10,
 *       overScan: 1,
 *       columns: 1
 *     });
 *
 *     return (
 *       <View>
 *         <Button onClick={() => vlScrollToItem('item-500')}>Scroll to #500</Button>
 *         <Text>Active Chunk: {vlActiveIndex}</Text>
 *         {vlChunks.map((chunk, ci) => (
 *           <View key={ci} id={`vl-chunk-${ci}`} className="vl-chunk" style={vlStyles[ci]}>
 *             {vlVisible[ci] && chunk.map((item) => (
 *               <MyItem key={item.id} item={item} index={item.__vlIdx} />
 *             ))}
 *           </View>
 *         ))}
 *       </View>
 *     );
 *   }
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseVirtualListOptions<T> {
  items: T[];
  /** Estimated height (px) of a single item — used for initial placeholder sizing */
  itemHeight?: number;
  /** Number of items per chunk. If not configured, auto-scales based on dataset length */
  chunkSize?: number;
  /** Number of extra chunks to render above and below the viewport bounds */
  overScan?: number;
  /** Number of layout columns (1 for list, >1 for grid) */
  columns?: number;
  /** Disable virtualization (e.g., when UI is minimized) to avoid unnecessary processing */
  disabled?: boolean;
}

export interface VirtualListResult<T> {
  /** Chunked item arrays, each item augmented with `__vlIdx` (absolute index) */
  vlChunks: Array<
    T & {
      __vlIdx: number;
    }
  >[];
  /** Per-chunk visibility flags */
  vlVisible: boolean[];
  /** Per-chunk inline style strings (height placeholders) */
  vlStyles: string[];
  /** Index of the first visible chunk currently in viewport */
  vlActiveIndex: number;
  /** Array of all currently visible chunk indices */
  vlVisibleIndices: number[];
  /** Scroll programmatically to target item index */
  vlScrollTo: (index: number, options?: { duration?: number }) => number;
  /** Scroll programmatically to target item object reference or ID key */
  vlScrollToItem: (target: any, options?: { duration?: number; keyProperty?: string }) => number;
}

export function useVirtualList<T>(options: UseVirtualListOptions<T>): VirtualListResult<T> {
  const { items, itemHeight = 80, chunkSize, overScan = 1, columns = 1, disabled = false } = options;

  const [vlChunks, setVlChunks] = useState<any[][]>([]);
  const [vlVisible, setVlVisible] = useState<boolean[]>([]);
  const [vlStyles, setVlStyles] = useState<string[]>([]);

  const observerRef = useRef<any>(null);
  const visibleRef = useRef<boolean[]>([]);
  const stylesRef = useRef<string[]>([]);
  const chunksRef = useRef<any[][]>([]);
  const prevItemsRef = useRef<any[]>([]);
  const prevChunkSizeRef = useRef<number>(10);
  const prevItemHeightRef = useRef<number>(itemHeight);
  const prevChunksCountRef = useRef<number>(0);
  const isAppendRef = useRef<boolean>(false);
  const isUnmountingRef = useRef<boolean>(false);
  const prevChunksLengthRef = useRef<number>(0);

  const disconnectAll = useCallback(() => {
    if (observerRef.current) {
      try {
        observerRef.current.disconnect();
      } catch (_) {
        /* noop */
      }
    }
    observerRef.current = null;
  }, []);

  // Track unmount lifecycle specifically
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
    };
  }, []);

  // Chunk the items whenever the input array or sizing changes
  useEffect(() => {
    if (disabled) {
      setVlChunks([]);
      setVlVisible([]);
      setVlStyles([]);
      chunksRef.current = [];
      visibleRef.current = [];
      stylesRef.current = [];
      prevItemsRef.current = [];
      return;
    }

    const prevItems = prevItemsRef.current;
    prevItemsRef.current = items;

    // Determine current chunkSize (property if configured, otherwise dynamically scaled)
    let currentChunkSize = chunkSize;
    if (!currentChunkSize) {
      if (prevChunksCountRef.current > 0) {
        currentChunkSize = prevChunkSizeRef.current || 10;
      } else {
        currentChunkSize = Math.max(10, Math.min(100, Math.ceil(items.length / 300)));
      }
    }

    const prevChunkSize = prevChunkSizeRef.current;
    const prevItemHeight = prevItemHeightRef.current;
    prevChunkSizeRef.current = currentChunkSize;
    prevItemHeightRef.current = itemHeight;

    // Check if it is an append operation (same start item, length >= old length, same sizing configuration)
    const isAppend =
      prevItems.length > 0 &&
      items.length >= prevItems.length &&
      items[0] === prevItems[0] &&
      currentChunkSize === prevChunkSize &&
      itemHeight === prevItemHeight;
    isAppendRef.current = isAppend;

    let chunks: any[][] = [];

    if (isAppend) {
      const oldChunks = vlChunks;
      prevChunksCountRef.current = oldChunks.length;

      // Shallow clone existing chunks to avoid mutation issues
      chunks = oldChunks.map((c) => [...c]);

      const oldItemsCount = prevItems.length;
      const newRawItems = items.slice(oldItemsCount);

      // Map only new items with absolute index
      const mappedNew = newRawItems.map((item, idx) => {
        const absoluteIdx = oldItemsCount + idx;
        if (typeof item === "object" && item !== null) {
          return { ...item, __vlIdx: absoluteIdx };
        }
        return item;
      });

      let remainingNew = mappedNew;

      if (chunks.length > 0) {
        const lastChunkIndex = chunks.length - 1;
        const lastChunk = chunks[lastChunkIndex];
        if (lastChunk.length < currentChunkSize) {
          const slotsOpen = currentChunkSize - lastChunk.length;
          const itemsToFill = mappedNew.slice(0, slotsOpen);
          chunks[lastChunkIndex] = lastChunk.concat(itemsToFill);

          // If the last chunk is off-screen, recalculate height placeholder
          if (!visibleRef.current[lastChunkIndex]) {
            stylesRef.current[lastChunkIndex] =
              "height: " + Math.ceil(chunks[lastChunkIndex].length / columns) * itemHeight + "px;";
          }

          remainingNew = mappedNew.slice(slotsOpen);
        }
      }

      const newChunks: any[][] = [];
      for (let i = 0; i < remainingNew.length; i += currentChunkSize) {
        newChunks.push(remainingNew.slice(i, i + currentChunkSize));
      }

      newChunks.forEach((chunk) => {
        chunks.push(chunk);
        visibleRef.current.push(false);
        stylesRef.current.push("height: " + Math.ceil(chunk.length / columns) * itemHeight + "px;");
      });

      chunksRef.current = chunks;
      setVlChunks(chunks);
      setVlVisible([...visibleRef.current]);
      setVlStyles([...stylesRef.current]);
    } else {
      prevChunksCountRef.current = 0;
      const mapped = items.map((item, idx) => {
        if (typeof item === "object" && item !== null) {
          return { ...item, __vlIdx: idx };
        }
        return item;
      });

      for (let i = 0; i < mapped.length; i += currentChunkSize) {
        chunks.push(mapped.slice(i, i + currentChunkSize));
      }

      const visibleList: boolean[] = [];
      const stylesList: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const isFirst = i === 0;
        visibleList.push(isFirst);
        stylesList.push(
          isFirst
            ? "height: auto;"
            : "height: " + Math.ceil(chunks[i].length / columns) * itemHeight + "px;",
        );
      }

      visibleRef.current = visibleList;
      stylesRef.current = stylesList;

      chunksRef.current = chunks;
      setVlChunks(chunks);
      setVlVisible(visibleList);
      setVlStyles(stylesList);
    }
  }, [items, itemHeight, chunkSize, columns, disabled]);

  const lastMeasuredHeightsRef = useRef<number[]>([]);

  useEffect(() => {
    if (disabled || vlChunks.length === 0) {
      disconnectAll();
      prevChunksLengthRef.current = 0;
      return;
    }

    // Only recreate observer when number of chunks changes to avoid lag
    if (observerRef.current && vlChunks.length === prevChunksLengthRef.current) {
      return;
    }

    prevChunksLengthRef.current = vlChunks.length;
    disconnectAll();

    const timer = setTimeout(() => {
      const runtimeTaro = require("@tarojs/taro") as any;
      const page = runtimeTaro.getCurrentInstance()?.page;
      if (!page) return;

      const currentChunkSize = prevChunkSizeRef.current || 10;
      const buffer = overScan * Math.ceil(currentChunkSize / columns) * itemHeight;

      observerRef.current = runtimeTaro.createIntersectionObserver(page, { observeAll: true });
      observerRef.current
        .relativeToViewport({ top: buffer, bottom: buffer })
        .observe(".vl-chunk", (res: any) => {
          const indexStr = res.id.replace("vl-chunk-", "");
          const targetIndex = parseInt(indexStr, 10);
          if (isNaN(targetIndex)) return;

          const isIn = res.intersectionRatio > 0;
          const wasIn = visibleRef.current[targetIndex];

          if (isIn && !wasIn) {
            visibleRef.current[targetIndex] = true;
            stylesRef.current[targetIndex] = "height: auto;";
            setVlVisible([...visibleRef.current]);
            setVlStyles([...stylesRef.current]);
          } else if (!isIn && wasIn) {
            // Measure the chunk's rendered height BEFORE hiding its content.
            // The boundingClientRect query is async — we must capture the real height
            // while the chunk is still rendered, otherwise we get 0px and the scroll
            // space collapses, making it impossible to scroll back up.
            const query = runtimeTaro.createSelectorQuery();
            query
              .select("#vl-chunk-" + targetIndex)
              .boundingClientRect((rect: any) => {
                if (!rect) return;

                let measuredHeight = rect.height;

                // Calculate a minimum fallback height based on chunk content
                const chunkLength = chunksRef.current[targetIndex]
                  ? chunksRef.current[targetIndex].length
                  : currentChunkSize;
                const estimatedHeight = Math.ceil(chunkLength / columns) * itemHeight;

                // If measured height is 0 or unreasonably small (race condition where
                // content was already unmounted), use the last known good height or
                // the estimated height to prevent scroll space from collapsing.
                if (!measuredHeight || measuredHeight < estimatedHeight * 0.3) {
                  measuredHeight =
                    lastMeasuredHeightsRef.current[targetIndex] || estimatedHeight;
                } else {
                  // Cache this as a known good height
                  lastMeasuredHeightsRef.current[targetIndex] = measuredHeight;
                }

                visibleRef.current[targetIndex] = false;
                stylesRef.current[targetIndex] = "height: " + measuredHeight + "px;";
                setVlVisible([...visibleRef.current]);
                setVlStyles([...stylesRef.current]);
              })
              .exec();
          }
        });
    }, 100);

    return () => {
      clearTimeout(timer);
      if (isUnmountingRef.current) {
        disconnectAll();
      }
    };
  }, [vlChunks.length, overScan, itemHeight, columns, disconnectAll, disabled]);

  useEffect(() => {
    return () => disconnectAll();
  }, [disconnectAll]);

  const vlScrollTo = useCallback(
    (index: number, options?: { duration?: number }) => {
      if (index < 0 || index >= items.length) return 0;

      const currentChunkSize = prevChunkSizeRef.current || 10;
      const chunkIndex = Math.floor(index / currentChunkSize);
      let scrollTop = 0;

      for (let i = 0; i < chunkIndex; i++) {
        const style = stylesRef.current[i] || "";
        const match = style.match(/height:\s*([\d.]+)/);
        if (match) {
          scrollTop += parseFloat(match[1]);
        } else {
          const chunkLength = chunksRef.current[i] ? chunksRef.current[i].length : currentChunkSize;
          scrollTop += Math.ceil(chunkLength / columns) * itemHeight;
        }
      }

      scrollTop += Math.floor((index % currentChunkSize) / columns) * itemHeight;

      const duration = options && typeof options.duration === "number" ? options.duration : 0;
      const runtimeTaro = require("@tarojs/taro") as any;
      runtimeTaro.pageScrollTo({
        scrollTop,
        duration,
      });

      return scrollTop;
    },
    [items.length, itemHeight, columns],
  );

  const vlScrollToItem = useCallback(
    (target: any, options?: { duration?: number; keyProperty?: string }) => {
      const keyProperty = options?.keyProperty || "id";
      const index = items.findIndex((item) => {
        if (typeof target === "object" && target !== null) {
          return item === target;
        }
        return item && (item as any)[keyProperty] === target;
      });

      if (index !== -1) {
        return vlScrollTo(index, options);
      }
      return 0;
    },
    [items, vlScrollTo],
  );

  const vlVisibleIndices = vlVisible.map((v, i) => (v ? i : -1)).filter((i) => i !== -1);
  const vlActiveIndex = vlVisibleIndices.length > 0 ? vlVisibleIndices[0] : -1;

  // Filter chunks through Data Windowing before yielding to render tree
  const renderedChunks = vlChunks.map((chunk, idx) => {
    return vlVisible[idx] ? chunk : [];
  });

  return {
    vlChunks: renderedChunks,
    vlVisible,
    vlStyles,
    vlActiveIndex,
    vlVisibleIndices,
    vlScrollTo,
    vlScrollToItem,
  };
}
