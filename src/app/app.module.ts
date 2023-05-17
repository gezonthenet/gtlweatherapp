import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CompressionService } from './compression.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LabelPipe } from './label.pipe';


@NgModule({
  declarations: [
    AppComponent,
    LabelPipe
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule
  ],
  providers: [CompressionService],
  bootstrap: [AppComponent]
})
export class AppModule { }
