'use client'

import React from 'react'
import Link from 'next/link'
import { isNil } from 'lodash-es'
import { toast } from 'sonner'
import { useClient, useQuery } from 'urql'

import { DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { graphql } from '@/lib/gql/generates'
import { GitRepositoriesQueryVariables } from '@/lib/gql/generates/graphql'
import { useMutation } from '@/lib/tabby/gql'
import { listRepositories } from '@/lib/tabby/query'
import { Button, buttonVariants } from '@/components/ui/button'
import { IconPlay, IconSpinner, IconTrash } from '@/components/ui/icons'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import LoadingWrapper from '@/components/loading-wrapper'

const deleteRepositoryMutation = graphql(/* GraphQL */ `
  mutation deleteGitRepository($id: ID!) {
    deleteGitRepository(id: $id)
  }
`)

const PAGE_SIZE = DEFAULT_PAGE_SIZE

export default function RepositoryTable() {
  const client = useClient()
  const [{ data, fetching }] = useQuery({
    query: listRepositories,
    variables: { first: PAGE_SIZE }
  })

  const [currentPage, setCurrentPage] = React.useState(1)
  const edges = data?.gitRepositories?.edges
  const pageInfo = data?.gitRepositories?.pageInfo
  const pageNum = Math.ceil((edges?.length || 0) / PAGE_SIZE)

  const currentPageRepos = React.useMemo(() => {
    return edges?.slice?.(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    )
  }, [currentPage, edges])

  const hasNextPage = pageInfo?.hasNextPage || currentPage < pageNum
  const hasPrevPage = currentPage > 1
  const showPagination =
    !!currentPageRepos?.length && (hasNextPage || hasPrevPage)

  const fetchRepositories = (variables: GitRepositoriesQueryVariables) => {
    return client.query(listRepositories, variables).toPromise()
  }

  const fetchRecordsSequentially = async (cursor?: string): Promise<number> => {
    const res = await fetchRepositories({ first: PAGE_SIZE, after: cursor })
    let count = res?.data?.gitRepositories?.edges?.length || 0
    const _pageInfo = res?.data?.gitRepositories?.pageInfo
    if (_pageInfo?.hasNextPage && _pageInfo?.endCursor) {
      // cacheExchange will merge the edges
      count = await fetchRecordsSequentially(_pageInfo.endCursor)
    }
    return count
  }

  const deleteRepository = useMutation(deleteRepositoryMutation)

  const handleNavToPrevPage = () => {
    if (currentPage <= 1) return
    if (fetching) return
    setCurrentPage(p => p - 1)
  }

  const handleFetchNextPage = () => {
    if (!hasNextPage) return
    if (fetching) return

    fetchRepositories({ first: PAGE_SIZE, after: pageInfo?.endCursor }).then(
      data => {
        if (data?.data?.gitRepositories?.edges?.length) {
          setCurrentPage(p => p + 1)
        }
      }
    )
  }

  const handleDeleteRepository = (id: string) => {
    deleteRepository({ id }).then(res => {
      if (res?.error) {
        toast.error(res.error.message)
        return
      }
    })
  }

  React.useEffect(() => {
    if (pageNum < currentPage && currentPage > 1) {
      setCurrentPage(pageNum)
    }
  }, [pageNum, currentPage])

  return (
    <LoadingWrapper loading={fetching}>
      <Table className="table-fixed border-b">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[25%]">Name</TableHead>
            <TableHead className="w-[45%]">Git URL</TableHead>
            <TableHead>Job</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!currentPageRepos?.length && currentPage === 1 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-[100px] text-center">
                No Data
              </TableCell>
            </TableRow>
          ) : (
            <>
              {currentPageRepos?.map(x => {
                const lastJobRun = x.node.jobInfo.lastJobRun
                const hasRunningJob =
                  !!lastJobRun?.id && isNil(lastJobRun.exitCode)
                return (
                  <TableRow key={x.node.id}>
                    <TableCell className="truncate">{x.node.name}</TableCell>
                    <TableCell className="truncate">{x.node.gitUrl}</TableCell>
                    <TableCell className="truncate">
                      <div className="flex items-center gap-1.5">
                        {hasRunningJob ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                href={`/jobs/detail?id=${lastJobRun.id}`}
                                className={buttonVariants({
                                  variant: 'ghost',
                                  size: 'icon'
                                })}
                              >
                                <IconSpinner />
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                              Navigate to job detail
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <IconPlay />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Run</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="flex justify-end">
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="hover-destructive"
                          onClick={() => handleDeleteRepository(x.node.id)}
                        >
                          <IconTrash />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </>
          )}
        </TableBody>
      </Table>
      {showPagination && (
        <Pagination className="my-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={!hasPrevPage}
                onClick={handleNavToPrevPage}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                disabled={!hasNextPage}
                onClick={handleFetchNextPage}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </LoadingWrapper>
  )
}
