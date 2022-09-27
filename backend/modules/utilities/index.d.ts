import { AxiosRequestConfig, AxiosResponse } from "axios";
import { PathLike } from "fs";

type FileType = "none" | "file" | "directory"
type RequestError = "BadBodyError" | "NoInternetError"

export namespace fs {
	export * from "fs/promises"
	export * from "fs"
	/**
	 * Decompresses a file archive
	 * @param input The input path
	 * @param output The output path
	 */
	export function decompress(input: PathLike, output: PathLike): Promise<void>
	/**
	 * Asynchronously deescalates a folder
	 * @param input A path to a file or directory. If a URL is provided, it must use the `file:` protocol. URL support is *experimental*.
	 */
	export function deescFolder(input: PathLike): Promise<void>
	/**
	 * Synchronously deescalates a folder
	 * @param input A path to a file or directory. If a URL is provided, it must use the `file:` protocol. URL support is *experimental*.
	 */
	export function deescFolderSync(input: PathLike): void
	/**
	 * Asynchronously checks the file's type
	 * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol. URL support is *experimental*.
	 * @returns The file type
	 */
	export function filetype(path: PathLike): Promise<FileType>
	/**
	 * Synchronously checks the file's type
	 * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol. URL support is *experimental*.
	 * @returns The file type
	 */
	export function filetypeSync(path: PathLike): FileType
	/**
	 * Asynchronously calculates a file's hash using the given algorithm
	 * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol. URL support is *experimental*.
	 * @param algorithm The algorithm to use to calculate the checksum.
	 * @returns The hash
	 */
	export function hashFile(path: PathLike, algorithm: string): Promise<Buffer>
	/**
	 * Asynchronously calculates a file's hash using the given algorithm
	 * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol. URL support is *experimental*.
	 * @param algorithm The algorithm to use to calculate the checksum.
	 * @param encoding The encoding used to convert the hash to a string.
	 * @returns The hash
	 */
	export function hashFile(path: PathLike, algorithm: string, encoding: BufferEncoding): Promise<String>
	/**
	 * Synchronously calculates a file's hash using the given algorithm
	 * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol. URL support is *experimental*.
	 * @param algorithm The algorithm to use to calculate the checksum.
	 * @returns The hash
	 */
	export function hashFileSync(path: PathLike, algorithm: string): Buffer
	/**
	 * Synchronously calculates a file's hash using the given algorithm
	 * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol. URL support is *experimental*.
	 * @param algorithm The algorithm to use to calculate the checksum.
	 * @param encoding The encoding used to convert the hash to a string.
	 * @returns The hash
	 */
	export function hashFileSync(path: PathLike, algorithm: string, encoding: BufferEncoding): string
	/**
	 * Asynchronously removes a file or directory if it exists
	 * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol. URL support is *experimental*.
	 */
	export function remove(path: PathLike): Promise<void>
	/**
	 * Synchronously removes a file or directory if it exists
	 * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol. URL support is *experimental*.
	 */
	export function removeSync(path: PathLike): void
}
export namespace http {
	/**
	 * Downloads a file
	 * @param url The URL
	 * @param path The file path
	 * @param options The request options
	 */
	export function download(url: string, path: PathLike, options?: AxiosRequestConfig & {mime?: string, size?: number, hash?: string}): Promise<RequestError>
	/**
	 * Creates a simple web request
	 * @param url The URL
	 * @param options The request options
	 */
	export function request(url: string, options?: AxiosRequestConfig & {mime?: string, size?: number}): Promise<AxiosResponse<any> & {error?: RequestError}>
}
/**
 * `setTimeout()` but in Promise form
 * @param milliseconds The amount of milliseconds to wait for
 */
export function timeout(milliseconds: number): Promise<void>