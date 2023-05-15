"use client";

import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";

import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { extend } from "ol/extent";

interface DataTableProps<TData, TValue>
    extends React.HTMLAttributes<HTMLTableElement> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    onRowClick?: (row: TData) => void;
    onRowMouseOver?: (row: TData) => void;
    onRowMouseLeave?: (row: TData) => void;
    rowClassName?: (row: TData) => string;
}

export function DataTable<TData, TValue>({
    columns,
    data,
    onRowClick,
    onRowMouseOver,
    onRowMouseLeave,
    rowClassName,
    ...props
}: DataTableProps<TData, TValue>) {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className="rounded-md border max-h-full overflow-auto">
            <Table {...props}>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                    <TableHead
                                        key={header.id}
                                        className="sticky top-0 z-10"
                                        style={{
                                            boxShadow:
                                                "inset 0 -1px 0 hsl(var(--border))",
                                        }}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef
                                                      .header,
                                                  header.getContext()
                                              )}
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && "selected"}
                                onClick={
                                    onRowClick
                                        ? () => onRowClick(row.original)
                                        : undefined
                                }
                                onMouseOver={
                                    onRowMouseOver
                                        ? () => onRowMouseOver(row.original)
                                        : undefined
                                }
                                onMouseLeave={
                                    onRowMouseLeave
                                        ? () => onRowMouseLeave(row.original)
                                        : undefined
                                }
                                className={rowClassName?.(row.original)}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id}>
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext()
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell
                                colSpan={columns.length}
                                className="h-24 text-center"
                            >
                                No results.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="border-b-0">
                        <TableCell
                            colSpan={columns.length}
                            className="sticky bottom-0 bg-white"
                            style={{
                                boxShadow: "inset 0 1px 0 hsl(var(--border))",
                            }}
                        >
                            jkfldajkfdlsa;
                        </TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}