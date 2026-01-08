import {AxiosPromise } from "axios";
import axios from "axios"

export interface apiReply<T>{
    data: T;
    status: number;
    statusText: string;
    headers: unknown;
    config: unknown;
}

export interface apiError<T>{
    response: apiReply<T>;
    message: string;
}

/* Primitive Requests functions */
export function makeRequest<T> (url:string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', data?:unknown): AxiosPromise<T> {

    return axios({url, method, data}).catch(err => {
        throw {
            response: err.response,
            message: err.message
        } as apiError<T>;
    })
}

export function GET<T>(url:string): AxiosPromise<T> {
    return makeRequest<T>(url, 'GET').catch(err =>{
        throw err as apiError<T>;
    })
}

export function POST<T>(url:string): AxiosPromise<T> {
    return makeRequest<T>(url, 'POST').catch(err =>{
        throw err as apiError<T>;
    })
}

export function PUT<T>(url:string): AxiosPromise<T> {
    return makeRequest<T>(url, 'PUT').catch(err =>{
        throw err as apiError<T>;
    })
}

export function DELETE<T>(url:string): AxiosPromise<T> {
    return makeRequest<T>(url, 'DELETE').catch(err =>{
        throw err as apiError<T>;
    })
}
