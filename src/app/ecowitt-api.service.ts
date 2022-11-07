import { Injectable } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { map, switchMap, switchMapTo, tap } from 'rxjs/operators';
import { merge, Observable, of } from 'rxjs';
import { Location } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class EcowittApiService {

  APPLICATION_KEY: string = "";
  API_KEY: string = "";


  //https://api.ecowitt.net/api/v3/device/history?application_key=APPLICATION_KEY&api_key=API_KEY&mac=YOUR_MAC_CODE_OF_DEVICE&start_date=2022-01-01 00:00:00&end_date=2022-01-01 23:59:59&cycle_type=auto&call_back=outdoor,indoor.humidity

  constructor(
    private http: HttpClient,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private location: Location
  ) { }
  
  executeEcowittApiCall(url: string, parameters?: any) {
    let params = new HttpParams();
    if (parameters) {
      Object.keys(parameters).forEach(key => {
        params = params.set(key, parameters[key]);
      });
    }
    const headers = new HttpHeaders({
      "Content-Type": "application/json",
    });
    return this.http.get(url, { 
      headers,
      params
   });
  }
 
  //reAuthenticate() {
  //  let ecowittOath = 'http://www.ecowitt.com/oauth/authorize?client_id=42870&response_type=code&redirect_uri='+window.location.href+'exchange_token&approval_prompt=force&scope=activity:read';
  //  window.location.href = ecowittOath;
  //}

  //create a function that will return the ecowitt api
  getEcowittApi() {
    return 'https://api.ecowitt.net/api/v3/device/';
  }

  getDevices() {
    //list?application_key=APPLICATION_KEY&api_key=API_KEY
    //history?application_key=APPLICATION_KEY&api_key=API_KEY&mac=YOUR_MAC_CODE_OF_DEVICE&start_date=2022-01-01 00:00:00&end_date=2022-01-01 23:59:59&cycle_type=auto&call_back=outdoor,indoor.humidity
    return this.getEcowittApi() + 'list?application_key='+this.APPLICATION_KEY+'&api_key='+this.API_KEY;
  }

  getDeviceDetail(mac: string) {
    //info?application_key=APPLICATION_KEY&api_key=API_KEY&mac=Your_MAC
    return this.getEcowittApi() + 'info?application_key='+this.APPLICATION_KEY+'&api_key='+this.API_KEY+'&mac='+mac;
  }
  
  getHistory(data: {mac: string, start_date: string; end_date: string; devices:string}) {
    console.log("fetching history data", data);
    //history?application_key=APPLICATION_KEY&api_key=API_KEY&mac=YOUR_MAC_CODE_OF_DEVICE&start_date=2022-01-01 00:00:00&end_date=2022-01-01 23:59:59&cycle_type=auto&call_back=outdoor,indoor.humidity
    return this.getEcowittApi() + 'history?application_key='+this.APPLICATION_KEY+'&api_key='+this.API_KEY+'&mac='+data.mac+'&start_date='+data.start_date+'&end_date='+data.end_date+'&cycle_type=5min&call_back='+data.devices+'&temp_unitid=1&rainfall_unitid=12';
  }

  getRealtime(data: {mac: string, devices:string}) {
    console.log("fetching realtime data", data);
    //history?application_key=APPLICATION_KEY&api_key=API_KEY&mac=YOUR_MAC_CODE_OF_DEVICE&start_date=2022-01-01 00:00:00&end_date=2022-01-01 23:59:59&cycle_type=auto&call_back=outdoor,indoor.humidity
    return this.getEcowittApi() + 'real_time?application_key='+this.APPLICATION_KEY+'&api_key='+this.API_KEY+'&mac='+data.mac+'&call_back='+data.devices+'&temp_unitid=1&rainfall_unitid=12';
  }

  

  

}
